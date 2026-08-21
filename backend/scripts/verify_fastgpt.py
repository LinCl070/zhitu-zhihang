"""Run a credential-safe SF-FastGPT acceptance check for both workflows."""

import asyncio
import json
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass

from app.clients.fastgpt import AssistantResponse, AssistantRoute, FastGPTClient, FastGPTClientError
from app.config import Settings, get_settings

DiagnosticQuery = Callable[[AssistantRoute, str], Awaitable[AssistantResponse]]

_ACCEPTANCE_QUESTIONS = {
    AssistantRoute.CAREER: "请依据已批准资料，说明软件工程专业学生本周应如何准备求职。",
    AssistantRoute.POLICY: "请依据已批准资料，说明校内就业指导服务的咨询渠道。",
}


@dataclass(frozen=True)
class WorkflowDiagnostic:
    route: str
    mode: str
    source_count: int
    sources_complete: bool
    handoff_recommended: bool
    passed: bool


async def collect_diagnostics(query: DiagnosticQuery) -> tuple[WorkflowDiagnostic, ...]:
    """Call each workflow without exposing answers, credentials, or raw platform payloads."""
    diagnostics: list[WorkflowDiagnostic] = []
    for route, question in _ACCEPTANCE_QUESTIONS.items():
        response = await query(route, question)
        sources_complete = bool(response.sources) and all(
            source.title and source.url and source.version_or_date for source in response.sources
        )
        diagnostics.append(
            WorkflowDiagnostic(
                route=route.value,
                mode=response.mode,
                source_count=len(response.sources),
                sources_complete=sources_complete,
                handoff_recommended=response.handoff_recommended,
                passed=(
                    response.mode == "sf_fastgpt"
                    and sources_complete
                    and not response.handoff_recommended
                ),
            )
        )
    return tuple(diagnostics)


async def _run(settings: Settings) -> tuple[WorkflowDiagnostic, ...]:
    client = FastGPTClient(settings)
    return await collect_diagnostics(lambda route, question: client.query(route, question))


def main() -> int:
    settings = get_settings()
    if settings.fastgpt_mode != "sf_fastgpt":
        print("SF-FastGPT acceptance check requires FASTGPT_MODE=sf_fastgpt.")
        return 2

    try:
        diagnostics = asyncio.run(_run(settings))
    except FastGPTClientError:
        print("SF-FastGPT acceptance check failed without exposing platform details.")
        return 1

    print(json.dumps([asdict(item) for item in diagnostics], ensure_ascii=True, indent=2))
    return 0 if all(item.passed for item in diagnostics) else 1


if __name__ == "__main__":
    raise SystemExit(main())
