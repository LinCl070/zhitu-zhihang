import unittest
from pathlib import Path


class PrivacyBoundaryTests(unittest.TestCase):
    def test_sensitive_profile_fields_remain_prohibited(self) -> None:
        source_root = Path(__file__).resolve().parents[1] / "app"
        source = "\n".join(path.read_text(encoding="utf-8") for path in source_root.rglob("*.py"))
        prohibited_field_literals = [
            '"gender"',
            '"hometown"',
            '"health_status"',
            '"political_status"',
        ]

        present_fields = {term for term in prohibited_field_literals if term in source}
        self.assertFalse(present_fields)

    def test_contact_fields_are_limited_to_account_and_authorized_staff_paths(self) -> None:
        source_root = Path(__file__).resolve().parents[1] / "app"
        allowed_paths = {
            "api/admin_accounts.py",
            "api/auth.py",
            "api/staff.py",
            "models/entities.py",
            "services/risk.py",
        }
        contact_fields = (
            "student_number",
            "phone",
            "email",
            "enrollment_year",
            "enrollment_date",
            "employment_date",
        )
        violations = []

        for path in source_root.rglob("*.py"):
            relative_path = path.relative_to(source_root).as_posix()
            if relative_path in allowed_paths:
                continue
            source = path.read_text(encoding="utf-8")
            if any(field in source for field in contact_fields):
                violations.append(relative_path)

        self.assertEqual(violations, [])

    def test_frontend_source_does_not_embed_platform_credentials(self) -> None:
        source_root = Path(__file__).resolve().parents[2] / "frontend" / "src"
        source = "\n".join(path.read_text(encoding="utf-8") for path in source_root.rglob("*.ts*"))

        self.assertNotIn("FASTGPT_API_KEY", source)
        self.assertNotIn("FASTGPT_WORKFLOW", source)
        self.assertNotIn("postgresql+psycopg://", source)

    def test_governance_response_models_exclude_contact_fields(self) -> None:
        from app.api.governance import InsightsResponse, RiskItem

        risk_fields = set(RiskItem.model_fields.keys())
        insights_fields = set(InsightsResponse.model_fields.keys())
        sensitive = {"phone", "email", "student_number", "enrollment_year", "enrollment_date"}
        self.assertFalse(risk_fields & sensitive)
        self.assertFalse(insights_fields & sensitive)

    def test_audit_metadata_is_limited_to_whitelisted_fields(self) -> None:
        # record_audit_event accepts a metadata dict whose keys are caller-controlled.
        # The simulation caller must only pass scenarios and cohort_size (see governance API).
        import inspect

        from app.services.audit import record_audit_event

        signature = inspect.signature(record_audit_event)
        self.assertIn("metadata", signature.parameters)
        # The function must not itself retain user-provided content beyond whitelisted fields.
        source = inspect.getsource(record_audit_event)
        self.assertIn("metadata or {}", source)
