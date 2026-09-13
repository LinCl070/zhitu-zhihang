import asyncio
import json
import unittest

import httpx
from app.clients.fastgpt import AssistantResponse, AssistantRoute, FastGPTClient, MockFastGPTClient
from app.config import Settings
from app.services.assistant import AssistantService


class FastGPTAdapterTests(unittest.TestCase):
    def test_real_fastgpt_answer_without_sources_is_preserved_with_a_handoff_notice(self) -> None:
        class NoSourceFastGPTClient:
            async def query(
                self,
                route: AssistantRoute,
                question: str,
                context: dict[str, object] | None = None,
            ) -> AssistantResponse:
                return AssistantResponse(
                    answer="Keep this platform answer visible.",
                    sources=(),
                    disclaimer="Platform response disclaimer.",
                    handoff_recommended=False,
                    mode="sf_fastgpt",
                )

        service = AssistantService(NoSourceFastGPTClient())

        response = asyncio.run(service.query(AssistantRoute.CAREER, "How should I prepare?"))

        self.assertEqual(response.answer, "Keep this platform answer visible.")
        self.assertEqual(response.sources, ())
        self.assertTrue(response.handoff_recommended)
        self.assertIn("平台未返回可核验来源", response.disclaimer)

    def test_mock_mode_returns_the_safe_handoff_contract(self) -> None:
        service = AssistantService(MockFastGPTClient())

        response = asyncio.run(service.query(AssistantRoute.CAREER, "How should I prepare?"))

        self.assertEqual(response.mode, "mock")
        self.assertTrue(response.handoff_recommended)
        self.assertEqual(response.sources, ())
        self.assertIn("人工确认", response.answer)

    def test_mock_mode_answers_docker_skill_questions_with_approved_source(self) -> None:
        service = AssistantService(MockFastGPTClient())

        concept_questions = (
            "什么是 Docker？",
            "什么是Docker",
            "什么是容器",
            "what is docker",
            "what is a container?",
            "Docker是什么",
            "Docker 和虚拟机有什么区别？",
            "容器与虚拟机的本质区别",
            "简述 Docker",
            "解释下 Docker",
            "Docker 原理是什么",
            "docker vs vm",
            "Docker有什么优势",
            "Docker和VM的比较",
            "讲讲 Docker",
            "聊聊 Docker",
        )
        for question in concept_questions:
            response = asyncio.run(service.query(AssistantRoute.CAREER, question))
            self.assertEqual(response.mode, "mock")
            self.assertFalse(response.handoff_recommended)
            self.assertTrue(len(response.sources) >= 1)
            self.assertEqual(response.sources[0].title, "Docker基础与岗位技能准备指南")
            self.assertEqual(response.sources[0].url, "https://docs.docker.com/get-started/")
            self.assertIn("开源容器引擎", response.answer)
            self.assertIn("Dockerfile", response.answer)
            self.assertIn("镜像", response.answer)
            self.assertIn("传统虚拟机", response.answer)
            self.assertIn("Namespace", response.answer)

        gap_questions = ("如何补齐 Docker 缺口？", "如何补齐Docker缺口", "DOCKER缺口怎么学")
        for question in gap_questions:
            response = asyncio.run(service.query(AssistantRoute.CAREER, question))
            self.assertEqual(response.mode, "mock")
            self.assertFalse(response.handoff_recommended)
            self.assertTrue(len(response.sources) >= 1)
            self.assertEqual(response.sources[0].title, "Docker基础与岗位技能准备指南")
            self.assertEqual(response.sources[0].url, "https://docs.docker.com/get-started/")
            self.assertIn("核心概念筑基", response.answer)
            self.assertIn("Dockerfile", response.answer)
            self.assertIn("docker-compose.yml", response.answer)

    def test_unexpected_client_exception_falls_back_to_unavailable(self) -> None:
        class CrashingClient:
            async def query(self, *args: object, **kwargs: object) -> AssistantResponse:
                raise RuntimeError("unexpected low-level crash")

        service = AssistantService(CrashingClient())  # type: ignore[arg-type]
        response = asyncio.run(service.query(AssistantRoute.CAREER, "any question"))
        self.assertEqual(response.mode, "unavailable")
        self.assertTrue(response.handoff_recommended)
        self.assertIn("暂不可用", response.answer)

    def test_real_fastgpt_answer_with_sources_remains_a_non_handoff_response(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "answer": "Use the approved career guide.",
                    "sources": [
                        {
                            "name": "Career guide",
                            "url": "https://example.invalid/guide",
                            "version": "v1.0",
                        }
                    ],
                },
            )

        service = AssistantService(
            FastGPTClient(self._settings(), transport=httpx.MockTransport(handler))
        )

        response = asyncio.run(service.query(AssistantRoute.CAREER, "How should I prepare?"))

        self.assertEqual(response.answer, "Use the approved career guide.")
        self.assertFalse(response.handoff_recommended)
        self.assertEqual(response.sources[0].title, "Career guide")

    def test_fastgpt_client_routes_career_application_and_normalizes_sources(self) -> None:
        captured: dict[str, object] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["url"] = str(request.url)
            captured["authorization"] = request.headers["Authorization"]
            captured["payload"] = json.loads(request.content)
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": "Use the approved career guide."}}],
                    "sources": [
                        {
                            "name": "Career guide",
                            "url": "https://example.invalid/guide",
                            "version": "v1.0",
                        }
                    ],
                },
            )

        client = FastGPTClient(self._settings(), transport=httpx.MockTransport(handler))
        response = asyncio.run(
            client.query(AssistantRoute.CAREER, "What should I prepare?", {"major": "Software"})
        )

        self.assertEqual(captured["url"], "https://fastgpt.example/api/v1/chat/completions")
        self.assertEqual(captured["authorization"], "Bearer career-test-key")
        self.assertTrue(captured["payload"]["chatId"].startswith("career-navigator-career-"))
        self.assertNotEqual(captured["payload"]["chatId"], "career-workflow")
        self.assertFalse(captured["payload"]["detail"])
        self.assertNotIn("appId", captured["payload"])
        self.assertNotIn("variables", captured["payload"])
        self.assertEqual(
            set(captured["payload"]), {"chatId", "stream", "detail", "messages"}
        )
        self.assertEqual(response.answer, "Use the approved career guide.")
        self.assertEqual(response.sources[0].title, "Career guide")
        self.assertEqual(response.sources[0].version_or_date, "v1.0")

    def test_fastgpt_client_uses_the_policy_scoped_key(self) -> None:
        captured: dict[str, object] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["authorization"] = request.headers["Authorization"]
            captured["payload"] = json.loads(request.content)
            return httpx.Response(200, json={"answer": "Policy guidance."})

        client = FastGPTClient(self._settings(), transport=httpx.MockTransport(handler))
        asyncio.run(client.query(AssistantRoute.POLICY, "What policy applies?"))

        self.assertEqual(captured["authorization"], "Bearer policy-test-key")
        self.assertNotIn("appId", captured["payload"])
        self.assertNotIn("variables", captured["payload"])

    def test_platform_failure_returns_a_safe_handoff_without_raw_error(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(503, text="platform diagnostic should not leave the backend")

        service = AssistantService(
            FastGPTClient(self._settings(), transport=httpx.MockTransport(handler))
        )

        response = asyncio.run(service.query(AssistantRoute.POLICY, "Can I apply now?"))

        self.assertEqual(response.mode, "unavailable")
        self.assertTrue(response.handoff_recommended)
        self.assertNotIn("platform diagnostic", response.answer)

    def test_query_assistant_api_degrades_gracefully_when_service_fails(self) -> None:
        from datetime import UTC, datetime, timedelta
        from unittest.mock import patch
        from uuid import uuid4

        from app.api.career import AssistantQueryRequest, query_assistant
        from app.auth.session import SessionPrincipal
        from app.models.entities import UserRole

        principal = SessionPrincipal(
            user_id=uuid4(),
            display_name="Test Student",
            role=UserRole.STUDENT,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )

        class MockSession:
            def scalar(self, *args: object, **kwargs: object) -> object:
                return None

            def add(self, *args: object, **kwargs: object) -> None:
                pass

            def flush(self) -> None:
                pass

            def commit(self) -> None:
                pass

        payload = AssistantQueryRequest(consultation_type="career", question="如何准备？")

        with patch(
            "app.api.career.create_assistant_service",
            side_effect=ValueError("Service misconfigured"),
        ):
            response = asyncio.run(
                query_assistant(payload, principal, MockSession())  # type: ignore[arg-type]
            )
            self.assertEqual(response.mode, "unavailable")
            self.assertTrue(response.handoff_recommended)
            self.assertIn("暂不可用", response.answer)

    def test_query_assistant_api_returns_docker_response_in_mock_mode(self) -> None:
        from datetime import UTC, datetime, timedelta
        from uuid import uuid4

        from app.api.career import AssistantQueryRequest, query_assistant
        from app.auth.session import SessionPrincipal
        from app.models.entities import UserRole

        principal = SessionPrincipal(
            user_id=uuid4(),
            display_name="Test Student",
            role=UserRole.STUDENT,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )

        class MockSession:
            def scalar(self, *args: object, **kwargs: object) -> object:
                return None

            def add(self, *args: object, **kwargs: object) -> None:
                pass

            def flush(self) -> None:
                pass

            def commit(self) -> None:
                pass

        from unittest.mock import patch

        payload = AssistantQueryRequest(consultation_type="career", question="什么是 Docker？")
        with patch("app.api.career.get_settings", return_value=self._mock_settings()):
            response = asyncio.run(
                query_assistant(payload, principal, MockSession())  # type: ignore[arg-type]
            )
            self.assertEqual(response.mode, "mock")
            self.assertFalse(response.handoff_recommended)
            self.assertIn("开源容器引擎", response.answer)
            self.assertEqual(response.sources[0].title, "Docker基础与岗位技能准备指南")

    @staticmethod
    def _mock_settings() -> Settings:
        return Settings(
            app_env="development",
            app_name="Career Navigator API",
            app_origin="http://localhost:5173",
            database_url="postgresql+psycopg://demo:demo@localhost:5432/career_navigator",
            fastgpt_mode="mock",
            fastgpt_base_url=None,
            fastgpt_api_key=None,
            fastgpt_api_key_career=None,
            fastgpt_api_key_policy=None,
            fastgpt_chat_completions_path="/api/v1/chat/completions",
            fastgpt_workflow_career_id=None,
            fastgpt_workflow_policy_id=None,
            admin_bootstrap_username=None,
            admin_bootstrap_password=None,
        )

    @staticmethod
    def _settings() -> Settings:
        return Settings(
            app_env="development",
            app_name="Career Navigator API",
            app_origin="http://localhost:5173",
            database_url="postgresql+psycopg://demo:demo@localhost:5432/career_navigator",
            fastgpt_mode="sf_fastgpt",
            fastgpt_base_url="https://fastgpt.example",
            fastgpt_api_key="server-only-test-key",
            fastgpt_api_key_career="career-test-key",
            fastgpt_api_key_policy="policy-test-key",
            fastgpt_chat_completions_path="/api/v1/chat/completions",
            fastgpt_workflow_career_id="career-workflow",
            fastgpt_workflow_policy_id="policy-workflow",
            admin_bootstrap_username=None,
            admin_bootstrap_password=None,
        )
