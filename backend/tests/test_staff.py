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

    def test_source_registry_indexes_docker_resource(self) -> None:
        from app.services.governance import read_source_registry

        sources = read_source_registry()
        docker_sources = [s for s in sources if s["asset_id"] == "SRC-DOCKER-SKILLS-202609"]
        self.assertEqual(len(docker_sources), 1)
        item = docker_sources[0]
        self.assertEqual(item["title"], "Docker基础与岗位技能准备指南")
        self.assertEqual(item["status"], "approved")
        self.assertEqual(item["published_on"], "2026-09-13")
        self.assertEqual(item["version"], "v1.0")
        self.assertEqual(item["asset_type"], "career_guidance")
        self.assertEqual(item["effective_until"], "2027-09-13")
        self.assertIn("06-Docker", item["source_uri_or_file"])
        self.assertIn("Docker技能准备", item["applicable_scope"])
