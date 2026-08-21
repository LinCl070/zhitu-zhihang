"""Runtime configuration with no dependency on local secrets in source control."""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal, cast
from urllib.parse import urlsplit

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _read_dotenv(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", maxsplit=1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


@dataclass(frozen=True)
class Settings:
    app_env: Literal["development", "demo", "production"]
    app_name: str
    app_origin: str
    database_url: str
    fastgpt_mode: Literal["mock", "sf_fastgpt"]
    fastgpt_base_url: str | None
    fastgpt_api_key: str | None
    fastgpt_api_key_career: str | None
    fastgpt_api_key_policy: str | None
    fastgpt_chat_completions_path: str
    fastgpt_workflow_career_id: str | None
    fastgpt_workflow_policy_id: str | None

    @classmethod
    def from_environment(cls, env_file: Path | None = None) -> "Settings":
        values = _read_dotenv(env_file or PROJECT_ROOT / ".env")
        app_env = os.getenv("APP_ENV", values.get("APP_ENV", "development"))
        fastgpt_mode = os.getenv("FASTGPT_MODE", values.get("FASTGPT_MODE", "mock"))
        database_url = os.getenv("DATABASE_URL", values.get("DATABASE_URL", "")).strip()

        if app_env not in {"development", "demo", "production"}:
            raise ValueError("APP_ENV must be development, demo, or production")
        if fastgpt_mode not in {"mock", "sf_fastgpt"}:
            raise ValueError("FASTGPT_MODE must be mock or sf_fastgpt")
        fastgpt_chat_completions_path = os.getenv(
            "FASTGPT_CHAT_COMPLETIONS_PATH",
            values.get("FASTGPT_CHAT_COMPLETIONS_PATH", "/api/v1/chat/completions"),
        ).strip()
        if (
            not fastgpt_chat_completions_path.startswith("/")
            or "://" in fastgpt_chat_completions_path
        ):
            raise ValueError("FASTGPT_CHAT_COMPLETIONS_PATH must be a relative API path")
        parsed_database_url = urlsplit(database_url)
        if (
            parsed_database_url.scheme != "postgresql+psycopg"
            or not parsed_database_url.hostname
            or "@" in parsed_database_url.hostname
            or not parsed_database_url.username
            or not parsed_database_url.password
            or not parsed_database_url.path.strip("/")
        ):
            raise ValueError(
                "DATABASE_URL must be a complete postgresql+psycopg URL with encoded credentials"
            )

        fastgpt_base_url = os.getenv("FASTGPT_BASE_URL", values.get("FASTGPT_BASE_URL")) or None
        fastgpt_api_key = os.getenv("FASTGPT_API_KEY", values.get("FASTGPT_API_KEY")) or None
        fastgpt_api_key_career = (
            os.getenv("FASTGPT_API_KEY_CAREER", values.get("FASTGPT_API_KEY_CAREER"))
            or fastgpt_api_key
            or None
        )
        fastgpt_api_key_policy = (
            os.getenv("FASTGPT_API_KEY_POLICY", values.get("FASTGPT_API_KEY_POLICY"))
            or fastgpt_api_key
            or None
        )
        fastgpt_workflow_career_id = (
            os.getenv("FASTGPT_WORKFLOW_CAREER_ID", values.get("FASTGPT_WORKFLOW_CAREER_ID"))
            or None
        )
        fastgpt_workflow_policy_id = (
            os.getenv("FASTGPT_WORKFLOW_POLICY_ID", values.get("FASTGPT_WORKFLOW_POLICY_ID"))
            or None
        )
        if fastgpt_mode == "sf_fastgpt" and not all(
            (
                fastgpt_base_url,
                fastgpt_api_key_career,
                fastgpt_api_key_policy,
                fastgpt_workflow_career_id,
                fastgpt_workflow_policy_id,
            )
        ):
            raise ValueError("SF-FastGPT mode requires base URL, API key, and both workflow IDs")

        return cls(
            app_env=cast(Literal["development", "demo", "production"], app_env),
            app_name=os.getenv("APP_NAME", values.get("APP_NAME", "Career Navigator API")),
            app_origin=os.getenv("APP_ORIGIN", values.get("APP_ORIGIN", "http://localhost:5173")),
            database_url=database_url,
            fastgpt_mode=cast(Literal["mock", "sf_fastgpt"], fastgpt_mode),
            fastgpt_base_url=fastgpt_base_url,
            fastgpt_api_key=fastgpt_api_key,
            fastgpt_api_key_career=fastgpt_api_key_career,
            fastgpt_api_key_policy=fastgpt_api_key_policy,
            fastgpt_chat_completions_path=fastgpt_chat_completions_path,
            fastgpt_workflow_career_id=fastgpt_workflow_career_id,
            fastgpt_workflow_policy_id=fastgpt_workflow_policy_id,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings.from_environment()
