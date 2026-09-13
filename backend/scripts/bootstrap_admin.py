"""Create the initial administrator from deployment environment variables.

Run only after database migrations:
    python -m scripts.bootstrap_admin
"""

from datetime import UTC, datetime

from app.auth.passwords import hash_password, normalize_username
from app.config import get_settings
from app.db.session import get_session_factory
from app.models.entities import User, UserRole
from app.services.audit import record_audit_event
from sqlalchemy import select


def main() -> None:
    settings = get_settings()
    if not settings.admin_bootstrap_username or not settings.admin_bootstrap_password:
        raise SystemExit("ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD are required")
    username = normalize_username(settings.admin_bootstrap_username)
    session = get_session_factory()()
    try:
        existing = session.scalar(select(User).where(User.username == username))
        if existing is not None:
            print("Administrator already exists; no password was changed.")
            return
        existing_admin = session.scalar(select(User.id).where(User.role == UserRole.ADMIN))
        if existing_admin is not None:
            print("An administrator already exists; no second administrator was created.")
            return
        user = User(
            username=username,
            display_name="系统管理员",
            role=UserRole.ADMIN,
            password_hash=hash_password(settings.admin_bootstrap_password),
            password_changed_at=datetime.now(UTC),
        )
        session.add(user)
        session.flush()
        record_audit_event(
            session,
            actor_id=user.id,
            actor_role=user.role,
            action="administrator_bootstrapped",
            resource_type="user",
            resource_id=user.id,
        )
        session.commit()
        print("Administrator created. Remove the bootstrap password from the environment now.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
