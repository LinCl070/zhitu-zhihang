"""Safe consultation service that hides FastGPT implementation details from API callers."""

from collections.abc import Mapping

from app.clients.fastgpt import (
    AssistantResponse,
    AssistantRoute,
    FastGPTClient,
    FastGPTClientError,
    MockFastGPTClient,
    handoff_response,
)
from app.config import Settings


class AssistantService:
    def __init__(self, client: FastGPTClient | MockFastGPTClient) -> None:
        self._client = client

    async def query(
        self, route: AssistantRoute, question: str, context: Mapping[str, object] | None = None
    ) -> AssistantResponse:
        try:
            response = await self._client.query(route, question, context)
        except FastGPTClientError:
            return handoff_response(mode="unavailable")

        if not response.sources:
            return handoff_response(mode=response.mode)
        return response


def create_assistant_service(settings: Settings) -> AssistantService:
    if settings.fastgpt_mode == "mock":
        return AssistantService(MockFastGPTClient())
    return AssistantService(FastGPTClient(settings))
