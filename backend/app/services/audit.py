"""Minimal, structured audit events that do not retain user-provided content."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.entities import AuditEvent, UserRole


def record_audit_event(
    session: Session,
    *,
    actor_id: UUID | None,
    actor_role: UserRole | None,
    action: str,
    resource_type: str,
    resource_id: UUID | None,
) -> AuditEvent:
    """Persist only whitelisted event fields; request and profile contents are excluded."""

    event = AuditEvent(
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata_json={},
    )
    session.add(event)
    session.flush()
    return event
