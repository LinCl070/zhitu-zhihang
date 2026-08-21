import unittest
from uuid import uuid4

from app.api.staff import AdvicePayload
from app.models.entities import TeacherAdvice
from pydantic import ValidationError


class StaffBoundaryTests(unittest.TestCase):
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
