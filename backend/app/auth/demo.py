"""Server-side demo identities and short-lived bearer sessions for the local showcase."""

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

DEMO_SESSION_TTL = timedelta(hours=8)


@dataclass(frozen=True)
class DemoIdentity:
    code: str
    user_id: UUID
    display_name: str
    role: UserRole


@dataclass(frozen=True)
class SessionPrincipal:
    user_id: UUID
    display_name: str
    role: UserRole
    expires_at: datetime


DEMO_IDENTITIES: dict[str, DemoIdentity] = {
    "student-a": DemoIdentity(
        "student-a",
        UUID("11111111-1111-1111-1111-111111111111"),
        "Demo Student A",
        UserRole.STUDENT,
    ),
    "student-b": DemoIdentity(
        "student-b",
        UUID("22222222-2222-2222-2222-222222222222"),
        "Demo Student B",
        UserRole.STUDENT,
    ),
    "counselor": DemoIdentity(
        "counselor",
        UUID("33333333-3333-3333-3333-333333333333"),
        "Demo Counselor",
        UserRole.COUNSELOR,
    ),
    "admin": DemoIdentity(
        "admin", UUID("44444444-4444-4444-4444-444444444444"), "Demo Administrator", UserRole.ADMIN
    ),
}


class DemoSessionStore:
    """In-memory sessions intentionally reset on server restart and are not production auth."""

    def __init__(self) -> None:
        self._sessions: dict[str, SessionPrincipal] = {}
        self._lock = Lock()

    def issue(self, identity: DemoIdentity) -> tuple[str, SessionPrincipal]:
        principal = SessionPrincipal(
            user_id=identity.user_id,
            display_name=identity.display_name,
            role=identity.role,
            expires_at=datetime.now(UTC) + DEMO_SESSION_TTL,
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


demo_session_store = DemoSessionStore()


def create_demo_session(session: Session, identity_code: str) -> tuple[str, SessionPrincipal]:
    identity = DEMO_IDENTITIES.get(identity_code)
    if identity is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown demo identity")

    for demo_identity in DEMO_IDENTITIES.values():
        if session.get(User, demo_identity.user_id) is None:
            session.add(
                User(
                    id=demo_identity.user_id,
                    display_name=demo_identity.display_name,
                    role=demo_identity.role,
                )
            )
    session.flush()
    record_audit_event(
        session,
        actor_id=identity.user_id,
        actor_role=identity.role,
        action="demo_session_created",
        resource_type="demo_session",
        resource_id=None,
    )
    session.commit()
    return demo_session_store.issue(identity)


def get_current_principal(
    authorization: str | None = Header(default=None),
) -> SessionPrincipal:
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    principal = demo_session_store.resolve(authorization.removeprefix("Bearer "))
    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )
    return principal


DbSession = Annotated[Session, Depends(get_db_session)]
CurrentPrincipal = Annotated[SessionPrincipal, Depends(get_current_principal)]


def require_roles(*allowed_roles: UserRole):
    def dependency(
        principal: CurrentPrincipal,
        session: DbSession,
    ) -> SessionPrincipal:
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
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return principal

    return dependency
