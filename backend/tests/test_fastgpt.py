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
