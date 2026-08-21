import asyncio
import unittest

from app.clients.fastgpt import AssistantResponse, AssistantRoute, AssistantSource
from scripts.verify_fastgpt import collect_diagnostics


class FastGPTDiagnosticTests(unittest.TestCase):
    def test_acceptance_requires_complete_sources_for_each_workflow(self) -> None:
        async def query(route: AssistantRoute, question: str) -> AssistantResponse:
            return AssistantResponse(
                answer="Not printed by the diagnostic.",
                sources=(
                    AssistantSource(
                        title=f"{route.value} source",
                        url="https://career.cuit.edu.cn/source",
                        version_or_date="2026-07-23",
                    ),
                ),
                disclaimer="",
                handoff_recommended=False,
                mode="sf_fastgpt",
            )

        diagnostics = asyncio.run(collect_diagnostics(query))

        self.assertEqual([item.route for item in diagnostics], ["career", "policy"])
        self.assertTrue(all(item.passed for item in diagnostics))

    def test_acceptance_rejects_handoff_or_incomplete_sources(self) -> None:
        async def query(route: AssistantRoute, question: str) -> AssistantResponse:
            return AssistantResponse(
                answer="Not printed by the diagnostic.",
                sources=(
                    AssistantSource(
                        title="Incomplete source",
                        url=None,
                        version_or_date=None,
                    ),
                ),
                disclaimer="",
                handoff_recommended=route is AssistantRoute.POLICY,
                mode="sf_fastgpt",
            )

        diagnostics = asyncio.run(collect_diagnostics(query))

        self.assertTrue(all(not item.passed for item in diagnostics))
        self.assertTrue(all(not item.sources_complete for item in diagnostics))
