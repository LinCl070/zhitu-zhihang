"""SF-FastGPT chat-completions adapter with no browser-facing credentials."""

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any
from uuid import uuid4

import httpx

from app.config import Settings


class AssistantRoute(StrEnum):
    CAREER = "career"
    POLICY = "policy"


@dataclass(frozen=True)
class AssistantSource:
    title: str
    url: str | None
    version_or_date: str | None


@dataclass(frozen=True)
class AssistantResponse:
    answer: str
    sources: tuple[AssistantSource, ...]
    disclaimer: str
    handoff_recommended: bool
    mode: str


class FastGPTClientError(Exception):
    """A safe internal signal that must not expose platform response details."""


class FastGPTClient:
    def __init__(
        self, settings: Settings, *, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        if (
            settings.fastgpt_base_url is None
            or settings.fastgpt_api_key_career is None
            or settings.fastgpt_api_key_policy is None
            or settings.fastgpt_workflow_career_id is None
            or settings.fastgpt_workflow_policy_id is None
        ):
            raise ValueError("SF-FastGPT client requires complete server-side configuration")

        self._endpoint = (
            f"{settings.fastgpt_base_url.rstrip('/')}{settings.fastgpt_chat_completions_path}"
        )
        self._api_keys = {
            AssistantRoute.CAREER: settings.fastgpt_api_key_career,
            AssistantRoute.POLICY: settings.fastgpt_api_key_policy,
        }
        # Environment variable names remain compatible with the existing deployment,
        # but the Agent Builder API expects these values as application IDs.
        self._app_ids = {
            AssistantRoute.CAREER: settings.fastgpt_workflow_career_id,
            AssistantRoute.POLICY: settings.fastgpt_workflow_policy_id,
        }
        self._transport = transport

    async def query(
        self, route: AssistantRoute, question: str, context: Mapping[str, object] | None = None
    ) -> AssistantResponse:
        if not question.strip():
            raise ValueError("Question must not be empty")

        payload = {
            "appId": self._app_ids[route],
            "chatId": f"career-navigator-{route.value}-{uuid4().hex}",
            "stream": False,
            "detail": False,
            "messages": [{"role": "user", "content": question.strip()}],
            "variables": dict(context or {}),
        }
        try:
            async with httpx.AsyncClient(transport=self._transport, timeout=15.0) as client:
                response = await client.post(
                    self._endpoint,
                    headers={"Authorization": f"Bearer {self._api_keys[route]}"},
                    json=payload,
                )
                response.raise_for_status()
                body = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise FastGPTClientError("SF-FastGPT request failed") from error

        answer = _extract_answer(body)
        if answer is None:
            raise FastGPTClientError("SF-FastGPT response was missing an answer")
        return AssistantResponse(
            answer=answer,
            sources=normalize_sources(body),
            disclaimer="智能建议仅供就业准备参考，不构成录用、资格或期限承诺。",
            handoff_recommended=False,
            mode="sf_fastgpt",
        )


class MockFastGPTClient:
    """Local response adapter used until approved FastGPT knowledge documents are available."""

    async def query(
        self, route: AssistantRoute, question: str, context: Mapping[str, object] | None = None
    ) -> AssistantResponse:
        if not question.strip():
            raise ValueError("Question must not be empty")
        return handoff_response(mode="mock")


def normalize_sources(payload: object) -> tuple[AssistantSource, ...]:
    if not isinstance(payload, Mapping):
        return ()
    raw_sources = payload.get("sources") or payload.get("sourceList")
    if raw_sources is None and isinstance(payload.get("responseData"), Mapping):
        raw_sources = payload["responseData"].get("sources")
    if isinstance(raw_sources, Mapping):
        raw_sources = [raw_sources]
    if not isinstance(raw_sources, list):
        return ()

    sources: list[AssistantSource] = []
    for raw_source in raw_sources:
        if not isinstance(raw_source, Mapping):
            continue
        title = _first_text(raw_source, "title", "name", "sourceName")
        if title is None:
            continue
        sources.append(
            AssistantSource(
                title=title,
                url=_first_text(raw_source, "url", "link", "sourceUrl"),
                version_or_date=_first_text(raw_source, "version", "publishedOn", "date"),
            )
        )
    return tuple(sources)


def handoff_response(*, mode: str) -> AssistantResponse:
    return AssistantResponse(
        answer=(
            "当前资料不足以确认该问题，请联系学校就业指导部门或招聘方人工确认。"
            "系统不会据此作出录用、资格或期限承诺。"
        ),
        sources=(),
        disclaimer="回答未引用已批准资料，已转为人工确认建议。",
        handoff_recommended=True,
        mode=mode,
    )


def _extract_answer(payload: object) -> str | None:
    if not isinstance(payload, Mapping):
        return None
    direct_answer = _first_text(payload, "answer", "text")
    if direct_answer is not None:
        return direct_answer
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        first_choice = choices[0]
        if isinstance(first_choice, Mapping) and isinstance(first_choice.get("message"), Mapping):
            return _first_text(first_choice["message"], "content")
    response_data = payload.get("responseData")
    if isinstance(response_data, Mapping):
        return _first_text(response_data, "answer", "text")
    return None


def _first_text(mapping: Mapping[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = mapping.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None
