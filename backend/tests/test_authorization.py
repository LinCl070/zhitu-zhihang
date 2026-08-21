import unittest
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from app.auth.demo import DemoIdentity, DemoSessionStore, SessionPrincipal
from app.models.entities import CareerProfile, UserRole
from app.services.authorization import (
    get_readable_career_profile,
    require_student_ownership,
)
from fastapi import HTTPException


class FakeSession:
    def __init__(
        self, profile: CareerProfile | None = None, has_counselor_access: bool = False
    ) -> None:
        self.profile = profile
        self.has_counselor_access = has_counselor_access
        self.added: list[object] = []
        self.commit_count = 0

    def get(self, model: type[CareerProfile], resource_id: UUID) -> CareerProfile | None:
        if model is CareerProfile and self.profile is not None and self.profile.id == resource_id:
            return self.profile
        return None

    def scalar(self, statement: object) -> UUID | None:
        return uuid4() if self.has_counselor_access else None

    def add(self, value: object) -> None:
        self.added.append(value)

    def flush(self) -> None:
        return None

    def commit(self) -> None:
        self.commit_count += 1


class AuthorizationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.student_a = uuid4()
        self.student_b = uuid4()
        self.profile = CareerProfile(
            id=uuid4(),
            student_id=self.student_b,
            major="Software Engineering",
            skills=["Python"],
            projects=["Anonymized project"],
            target_roles=["Backend Engineer"],
            target_cities=["Chengdu"],
            job_stage="preparing",
        )

    def test_student_cannot_read_another_students_profile_and_denial_is_redacted(self) -> None:
        session = FakeSession(profile=self.profile)
        principal = self._principal(self.student_a, UserRole.STUDENT)

        with self.assertRaises(HTTPException) as raised:
            get_readable_career_profile(session, principal, self.profile.id)

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(session.commit_count, 1)
        event = session.added[0]
        self.assertEqual(event.action, "access_denied")
        self.assertEqual(event.metadata_json, {})

    def test_counselor_requires_an_explicit_student_grant(self) -> None:
        principal = self._principal(uuid4(), UserRole.COUNSELOR)
        denied_session = FakeSession(profile=self.profile, has_counselor_access=False)

        with self.assertRaises(HTTPException) as raised:
            get_readable_career_profile(denied_session, principal, self.profile.id)

        self.assertEqual(raised.exception.status_code, 403)
        allowed_session = FakeSession(profile=self.profile, has_counselor_access=True)
        self.assertEqual(
            get_readable_career_profile(allowed_session, principal, self.profile.id).id,
            self.profile.id,
        )

    def test_non_owner_cannot_write_a_student_resource(self) -> None:
        session = FakeSession()
        principal = self._principal(uuid4(), UserRole.ADMIN)

        with self.assertRaises(HTTPException) as raised:
            require_student_ownership(session, principal, self.student_a, "action_plan", uuid4())

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(session.added[0].metadata_json, {})

    def test_demo_session_token_expires_in_memory(self) -> None:
        store = DemoSessionStore()
        identity = DemoIdentity("student", self.student_a, "Demo Student", UserRole.STUDENT)
        token, principal = store.issue(identity)

        self.assertEqual(store.resolve(token), principal)
        store._sessions["expired"] = SessionPrincipal(
            user_id=self.student_a,
            display_name="Demo Student",
            role=UserRole.STUDENT,
            expires_at=datetime.now(UTC) - timedelta(seconds=1),
        )
        self.assertIsNone(store.resolve("expired"))

    @staticmethod
    def _principal(user_id: UUID, role: UserRole) -> SessionPrincipal:
        return SessionPrincipal(
            user_id=user_id,
            display_name="Demo User",
            role=role,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )
