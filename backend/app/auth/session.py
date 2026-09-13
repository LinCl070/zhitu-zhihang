"""Opaque, server-side account sessions and FastAPI authorization dependencies."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from threading import Lock
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.models.entities import User, UserRole
from app.services.audit import record_audit_event

SESSION_TTL = timedelta(hours=8)


@dataclass(frozen=True)
class SessionPrincipal:
    user_id: UUID
    display_name: str
    role: UserRole
    expires_at: datetime


class AccountSessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionPrincipal] = {}
        self._lock = Lock()

    def issue(self, user: User) -> tuple[str, SessionPrincipal]:
        principal = SessionPrincipal(
            user_id=user.id,
            display_name=user.display_name,
            role=user.role,
            expires_at=datetime.now(UTC) + SESSION_TTL,
        )
        token = token_urlsafe(32)
        with self._lock:
            self._sessions[token] = principal
        return token, principal

    def resolve(self, token: str) -> SessionPrincipal | None:
        with self._lock:
            principal = self._sessions.get(token)
            if principal is None:
                return None
            if principal.expires_at <= datetime.now(UTC):
                del self._sessions[token]
                return None
            return principal

    def revoke_user(self, user_id: UUID) -> None:
        with self._lock:
            self._sessions = {
                token: principal
                for token, principal in self._sessions.items()
                if principal.user_id != user_id
            }


account_session_store = AccountSessionStore()


def get_current_principal(
    session: Annotated[Session, Depends(get_db_session)],
    authorization: str | None = Header(default=None),
) -> SessionPrincipal:
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )
    principal = account_session_store.resolve(authorization.removeprefix("Bearer "))
    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session"
        )
    user = session.get(User, principal.user_id)
    if user is None or not user.is_active:
        account_session_store.revoke_user(principal.user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session"
        )
    return principal


DbSession = Annotated[Session, Depends(get_db_session)]
CurrentPrincipal = Annotated[SessionPrincipal, Depends(get_current_principal)]


def require_roles(*allowed_roles: UserRole):
    def dependency(principal: CurrentPrincipal, session: DbSession) -> SessionPrincipal:
        if principal.role not in allowed_roles:
            record_audit_event(
                session,
                actor_id=principal.user_id,
                actor_role=principal.role,
                action="access_denied",
                resource_type="endpoint",
                resource_id=None,
            )
            session.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
            )
        return principal

    return dependency
