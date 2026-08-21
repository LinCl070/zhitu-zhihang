import unittest

import app.models  # noqa: F401
from app.db.base import Base


class ModelMetadataTests(unittest.TestCase):
    def test_required_tables_are_registered_without_prohibited_columns(self) -> None:
        expected_tables = {
            "users",
            "career_profiles",
            "counselor_student_access",
            "job_postings",
            "match_results",
            "teacher_advice",
            "action_plans",
            "audit_events",
        }
        prohibited_columns = {
            "gender",
            "hometown",
            "health_status",
            "political_status",
            "phone",
            "email",
            "student_number",
        }

        self.assertEqual(set(Base.metadata.tables), expected_tables)
        all_columns = {
            column.name for table in Base.metadata.tables.values() for column in table.columns
        }
        self.assertFalse(all_columns & prohibited_columns)

    def test_job_score_constraint_and_indexes_are_present(self) -> None:
        match_constraints = {
            constraint.name for constraint in Base.metadata.tables["match_results"].constraints
        }
        job_indexes = {index.name for index in Base.metadata.tables["job_postings"].indexes}

        self.assertIn("ck_match_results_score_range", match_constraints)
        self.assertIn("ix_job_postings_status_valid_until", job_indexes)

    def test_orm_enums_persist_the_postgresql_enum_values(self) -> None:
        user_role_values = Base.metadata.tables["users"].columns["role"].type.enums
        job_stage_values = Base.metadata.tables["career_profiles"].columns["job_stage"].type.enums

        self.assertEqual(user_role_values, ["student", "counselor", "admin"])
        self.assertEqual(job_stage_values, ["exploring", "preparing", "applying"])


if __name__ == "__main__":
    unittest.main()
