import unittest
from uuid import uuid4

from app.api.staff import AdvicePayload, CounselorStudentSummary, StudentAccountSummary
from app.models.entities import TeacherAdvice
from pydantic import ValidationError


class StaffBoundaryTests(unittest.TestCase):
    def test_authorized_staff_summaries_include_student_account_fields(self) -> None:
        student = CounselorStudentSummary(
            student_id=uuid4(),
            display_name="学生",
            student_number="2026000001",
            phone="13800138000",
            email="student@example.edu.cn",
            enrollment_year=2026,
            major="软件工程",
            target_roles=["后端开发"],
            target_cities=["成都"],
            job_stage="preparing",
            plans=[],
            advice=[],
        )
        account = StudentAccountSummary(
            id=student.student_id,
            display_name=student.display_name,
            role="student",
            student_number=student.student_number,
            phone=student.phone,
            email=student.email,
            enrollment_year=student.enrollment_year,
        )

        self.assertEqual(account.student_number, "2026000001")
        self.assertEqual(student.email, "student@example.edu.cn")

    def test_teacher_advice_is_limited_to_guidance_fields(self) -> None:
        columns = set(TeacherAdvice.__table__.columns.keys())

        self.assertEqual(
            columns,
            {"id", "counselor_id", "student_id", "action_plan_id", "content", "created_at"},
        )

    def test_teacher_advice_rejects_extra_fields_and_blank_content(self) -> None:
        with self.assertRaises(ValidationError):
            AdvicePayload(
                student_id=uuid4(),
                action_plan_id=uuid4(),
                content="   ",
                phone="not allowed",
            )
