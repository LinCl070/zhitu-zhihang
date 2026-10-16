import unittest

import app.models  # noqa: F401
from app.db.base import Base


class ModelMetadataTests(unittest.TestCase):
    def test_required_tables_are_registered_without_prohibited_columns(self) -> None:
        expected_tables = {
            "users",
            "password_reset_tokens",
            "career_profiles",
            "counselor_student_access",
            "job_postings",
            "match_results",
            "teacher_advice",
            "action_plans",
            "audit_events",
            "simulation_runs",
        }
        prohibited_columns = {
            "gender",
            "hometown",
            "health_status",
            "political_status",
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

    def test_authentication_columns_and_reset_token_constraints_are_present(self) -> None:
        users = Base.metadata.tables["users"]
        reset_tokens = Base.metadata.tables["password_reset_tokens"]

        self.assertTrue(users.columns["username"].unique)
        self.assertFalse(users.columns["password_hash"].nullable)
        self.assertFalse(users.columns["must_change_password"].nullable)
        self.assertIn("user_id", reset_tokens.c)
        self.assertIn("created_by", reset_tokens.c)
        self.assertTrue(reset_tokens.columns["token_hash"].unique)

    def test_student_account_profile_columns_and_number_constraint_are_present(self) -> None:
        users = Base.metadata.tables["users"]
        constraints = {constraint.name for constraint in users.constraints}

        self.assertTrue(users.columns["student_number"].unique)
        self.assertEqual(users.columns["student_number"].type.length, 10)
        self.assertIn("phone", users.c)
        self.assertIn("email", users.c)
        self.assertIn("enrollment_year", users.c)
        self.assertIn("ck_users_student_number_format", constraints)


if __name__ == "__main__":
    unittest.main()
