import unittest
from pathlib import Path


class PrivacyBoundaryTests(unittest.TestCase):
    def test_backend_business_source_has_no_prohibited_profile_fields(self) -> None:
        source_root = Path(__file__).resolve().parents[1] / "app"
        source = "\n".join(path.read_text(encoding="utf-8") for path in source_root.rglob("*.py"))
        prohibited_field_literals = [
            '"phone"',
            '"email"',
            '"student_number"',
            '"gender"',
            '"hometown"',
            '"health_status"',
            '"political_status"',
        ]

        present_fields = {term for term in prohibited_field_literals if term in source}
        self.assertFalse(present_fields)

    def test_frontend_source_does_not_embed_platform_credentials(self) -> None:
        source_root = Path(__file__).resolve().parents[2] / "frontend" / "src"
        source = "\n".join(path.read_text(encoding="utf-8") for path in source_root.rglob("*.ts*"))

        self.assertNotIn("FASTGPT_API_KEY", source)
        self.assertNotIn("FASTGPT_WORKFLOW", source)
        self.assertNotIn("postgresql+psycopg://", source)
