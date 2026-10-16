import unittest
from datetime import UTC, date, datetime
from uuid import uuid4

from app.api.admin_accounts import TeacherCreatePayload, create_teacher
from app.api.auth import (
    ChangePasswordPayload,
    CredentialsPayload,
    StudentRegistrationPayload,
    change_password,
    login,
    register_student,
)
from app.auth.passwords import hash_password, verify_password
from app.auth.session import SessionPrincipal, account_session_store, require_roles
from app.models.entities import User, UserRole
from fastapi import HTTPException
from pydantic import ValidationError


class FakeSession:
    def __init__(self, *, scalar_values=None, users=None) -> None:
        self.scalar_values = list(scalar_values or [])
        self.users = users or {}
        self.added = []
        self.commits = 0

    def scalar(self, statement):
        return self.scalar_values.pop(0) if self.scalar_values else None

    def get(self, model, object_id):
        return self.users.get(object_id)

    def add(self, value):
        self.added.append(value)

    def flush(self):
        for value in self.added:
            if getattr(value, "id", None) is None:
                value.id = uuid4()
            if isinstance(value, User):
                if value.is_active is None:
                    value.is_active = True
                if value.must_change_password is None:
                    value.must_change_password = False
                if value.failed_login_count is None:
                    value.failed_login_count = 0

    def commit(self):
        self.commits += 1

    def execute(self, statement):
        return None


def user(*, role=UserRole.STUDENT, password="SecurePass9", must_change=False):
    return User(
        id=uuid4(),
        username=f"user-{uuid4().hex[:8]}",
        display_name="测试用户",
        role=role,
        password_hash=hash_password(password),
        must_change_password=must_change,
        failed_login_count=0,
        is_active=True,
        password_changed_at=datetime.now(UTC),
    )


class AuthApiTests(unittest.TestCase):
    def tearDown(self) -> None:
        account_session_store._sessions.clear()

    def test_student_registration_forces_student_role_and_rejects_mismatch(self) -> None:
        session = FakeSession()
        result = register_student(
            StudentRegistrationPayload(
                username=" New.Student ",
                password="SecurePass9",
                password_confirmation="SecurePass9",
                name=" 新学生 ",
                student_number="2026000001",
                phone="13800138000",
                email="new.student@example.edu.cn",
                enrollment_date=date(2026, 9, 1),
            ),
            session,
        )
        created = next(item for item in session.added if isinstance(item, User))
        self.assertEqual(result.role, UserRole.STUDENT)
        self.assertEqual(created.username, "new.student")
        self.assertEqual(created.display_name, "新学生")
        self.assertEqual(created.student_number, "2026000001")
        self.assertEqual(created.phone, "13800138000")
        self.assertEqual(created.email, "new.student@example.edu.cn")
        self.assertEqual(created.enrollment_year, 2026)
        self.assertEqual(created.enrollment_date, date(2026, 9, 1))
        self.assertTrue(verify_password("SecurePass9", created.password_hash))
        with self.assertRaises(ValidationError):
            StudentRegistrationPayload(
                username="student-two",
                password="SecurePass9",
                password_confirmation="SecurePass9",
                name="学生",
                student_number="2026000002",
                phone="13800138001",
                email="student.two@example.edu.cn",
                enrollment_date=date(2026, 9, 1),
                role="admin",
            )

    def test_student_registration_rejects_invalid_number_and_duplicate_number(self) -> None:
        with self.assertRaises(ValidationError):
            StudentRegistrationPayload(
                username="student-three",
                password="SecurePass9",
                password_confirmation="SecurePass9",
                name="学生三",
                student_number="12345",
                phone="13800138002",
                email="student.three@example.edu.cn",
                enrollment_year=2026,
            )

        session = FakeSession(scalar_values=[None, uuid4()])
        with self.assertRaises(HTTPException) as raised:
            register_student(
                StudentRegistrationPayload(
                    username="student-four",
                    password="SecurePass9",
                    password_confirmation="SecurePass9",
                    name="学生四",
                    student_number="2026000001",
                    phone="13800138003",
                    email="student.four@example.edu.cn",
                    enrollment_date=date(2026, 9, 1),
                ),
                session,
            )
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.detail, "学号已被使用")

    def test_login_returns_server_role_and_records_success(self) -> None:
        account = user(role=UserRole.COUNSELOR)
        session = FakeSession(scalar_values=[account])
        response = login(
            CredentialsPayload(username=account.username, password="SecurePass9"), session
        )
        self.assertEqual(response.role, UserRole.COUNSELOR)
        self.assertTrue(response.access_token)
        self.assertEqual(response.token_type, "bearer")
        self.assertEqual(account.failed_login_count, 0)
        self.assertEqual(session.commits, 1)

    def test_invalid_login_uses_uniform_error_and_locks_after_five_failures(self) -> None:
        account = user()
        for _ in range(5):
            session = FakeSession(scalar_values=[account])
            with self.assertRaises(HTTPException) as raised:
                login(CredentialsPayload(username=account.username, password="WrongPass9"), session)
            self.assertEqual(raised.exception.status_code, 401)
        self.assertIsNotNone(account.locked_until)
        self.assertEqual(account.failed_login_count, 0)

    def test_change_password_revokes_existing_session(self) -> None:
        account = user()
        session = FakeSession(users={account.id: account})
        token, _ = account_session_store.issue(account)
        change_password(
            ChangePasswordPayload(
                current_password="SecurePass9",
                new_password="NewSecure8",
                password_confirmation="NewSecure8",
            ),
            SessionPrincipal(account.id, account.display_name, account.role, datetime.now(UTC)),
            session,
        )
        self.assertIsNone(account_session_store.resolve(token))
        self.assertFalse(account.must_change_password)
        self.assertTrue(verify_password("NewSecure8", account.password_hash))

    def test_teacher_creation_is_admin_only_and_role_is_fixed(self) -> None:
        administrator = user(role=UserRole.ADMIN)
        session = FakeSession(users={administrator.id: administrator})
        result = create_teacher(
            payload=TeacherCreatePayload(
                username="teacher-one",
                display_name="教师",
                phone="13800138000",
                email="teacher@example.edu.cn",
                employment_date=date(2026, 9, 1),
                password="TeacherPass9",
            ),
            principal=SessionPrincipal(
                administrator.id, administrator.display_name, administrator.role, datetime.now(UTC)
            ),
            session=session,
        )
        self.assertEqual(result.role, UserRole.COUNSELOR)
        self.assertTrue(result.must_change_password)
        created = next(item for item in session.added if isinstance(item, User))
        self.assertEqual(created.phone, "13800138000")
        self.assertEqual(created.email, "teacher@example.edu.cn")
        self.assertEqual(created.employment_date, date(2026, 9, 1))
        self.assertIsNotNone(created.password_changed_at)
        self.assertTrue(verify_password("TeacherPass9", created.password_hash))
        login_session = FakeSession(scalar_values=[created, None])
        login_result = login(
            CredentialsPayload(username="teacher-one", password="TeacherPass9"),
            login_session,
        )
        self.assertEqual(login_result.role, UserRole.COUNSELOR)
        self.assertTrue(login_result.must_change_password)
        self.assertTrue(
            any(
                isinstance(item, User) and item.role is UserRole.COUNSELOR
                for item in session.added
            )
        )

    def test_non_admin_is_rejected_by_admin_dependency(self) -> None:
        teacher = user(role=UserRole.COUNSELOR)
        dependency = require_roles(UserRole.ADMIN)
        with self.assertRaises(HTTPException) as raised:
            dependency(
                SessionPrincipal(
                    teacher.id, teacher.display_name, teacher.role, datetime.now(UTC)
                ),
                FakeSession(),
            )
        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
