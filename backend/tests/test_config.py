import unittest
from pathlib import Path
from tempfile import NamedTemporaryFile

from app.config import Settings


class SettingsTests(unittest.TestCase):
    def test_valid_configuration_uses_mock_mode_without_a_fastgpt_key(self) -> None:
        with NamedTemporaryFile("w", encoding="utf-8", delete=False) as env_file:
            env_file.write(
                "DATABASE_URL=postgresql+psycopg://demo:demo@localhost:5432/career_navigator\n"
            )
            env_file.write("FASTGPT_MODE=mock\n")
            env_path = Path(env_file.name)

        self.addCleanup(env_path.unlink)
        settings = Settings.from_environment(env_path)

        self.assertEqual(settings.fastgpt_mode, "mock")
        self.assertIsNone(settings.fastgpt_api_key)
        self.assertIsNone(settings.fastgpt_api_key_career)
        self.assertIsNone(settings.fastgpt_api_key_policy)
        self.assertTrue(settings.database_url.startswith("postgresql+psycopg://"))

    def test_missing_database_url_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "DATABASE_URL"):
            Settings.from_environment(Path("missing.env"))

    def test_incomplete_sf_fastgpt_configuration_is_rejected(self) -> None:
        with NamedTemporaryFile("w", encoding="utf-8", delete=False) as env_file:
            env_file.write(
                "DATABASE_URL=postgresql+psycopg://demo:demo@localhost:5432/career_navigator\n"
            )
            env_file.write("FASTGPT_MODE=sf_fastgpt\n")
            env_file.write("FASTGPT_BASE_URL=https://fastgpt.example\n")
            env_path = Path(env_file.name)

        self.addCleanup(env_path.unlink)
        with self.assertRaisesRegex(ValueError, "SF-FastGPT mode"):
            Settings.from_environment(env_path)

    def test_environment_template_contains_only_empty_fastgpt_secrets(self) -> None:
        template = Path(__file__).resolve().parents[2] / ".env.example"
        content = template.read_text(encoding="utf-8")

        self.assertIn("FASTGPT_MODE=mock", content)
        self.assertIn("FASTGPT_API_KEY=", content)
        self.assertIn("FASTGPT_API_KEY_CAREER=", content)
        self.assertIn("FASTGPT_API_KEY_POLICY=", content)
        self.assertNotIn("FASTGPT_API_KEY=sk-", content)


if __name__ == "__main__":
    unittest.main()
