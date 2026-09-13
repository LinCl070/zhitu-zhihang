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
            "chatId": f"career-navigator-{route.value}-{uuid4().hex}",
            "stream": False,
            "detail": False,
            "messages": [{"role": "user", "content": question.strip()}],
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

        lowered = question.lower()
        if "docker" in lowered or "容器" in lowered or "container" in lowered:
            concept_keywords = (
                "什么是",
                "定义",
                "概念",
                "是什么",
                "是啥",
                "介绍",
                "解释",
                "简述",
                "说说",
                "讲讲",
                "聊聊",
                "谈谈",
                "理解",
                "区别",
                "不同",
                "对比",
                "比较",
                "优势",
                "特点",
                "好处",
                "作用",
                "虚拟机",
                "vm",
                "vs",
                "原理",
                "架构",
                "核心",
                "what is",
                "difference",
                "compare",
                "explain",
            )
            if any(kw in lowered for kw in concept_keywords):
                answer = (
                    "依据《Docker基础与岗位技能准备指南》，"
                    "Docker 是基于操作系统级虚拟化技术的开源容器引擎，"
                    "通过将应用及其完整运行环境打包为轻量、可移植的镜像，实现“一次构建，到处运行”。\n\n"
                    "其核心技术要素包括：\n"
                    "1. 镜像 (Image)：包含运行环境的只读多层模板；\n"
                    "2. 容器 (Container)：镜像运行时的轻量独立实例，"
                    "共享宿主机内核并具备资源配额隔离；\n"
                    "3. 数据卷 (Volume)：用于数据库持久化与数据解耦的宿主机挂载存储；\n"
                    "4. 网络 (Network)：提供容器间通信与 DNS 服务发现的虚拟网络抽象；\n"
                    "5. Dockerfile：用于自动化规范构建轻量镜像的工程配方脚本。\n\n"
                    "与传统虚拟机相比，Docker 容器直接复用宿主机内核"
                    "（基于 Namespace 隔离与 Cgroups 限额），"
                    "避免了运行完整 Guest OS 的资源损耗，具备秒级启动与轻量优势。"
                    "如需在求职项目中补齐 Docker 技能，"
                    "建议参考文档指引编写 Dockerfile 并进行本地编排；"
                    "若有简历批改或疑难排查诉求，建议结合下方【转人工教师】通道当面确认。"
                )
            else:
                answer = (
                    "依据《Docker基础与岗位技能准备指南》，"
                    "针对技术岗位补齐 Docker 技能缺口的建议如下：\n\n"
                    "1. 核心概念筑基：理解镜像、容器、数据卷与网络配置，"
                    "掌握与传统虚拟机的区别。\n"
                    "2. 命令行与工程构建：熟练使用常用管理命令，"
                    "规范编写 Dockerfile（多阶段构建与轻量基础镜像）。\n"
                    "3. 组合与服务交付：使用 docker-compose.yml 编排微服务与中间件，"
                    "实现本地启动与数据持久化。\n"
                    "4. 实训与项目展示：将容器化落地于个人实训项目，"
                    "在简历与面试中量化呈现部署与一致性经验。\n\n"
                    "如需简历定向批改或实操疑问，"
                    "建议结合下方【转人工教师】通道向指导教师当面确认。"
                )
            return AssistantResponse(
                answer=answer,
                sources=(
                    AssistantSource(
                        title="Docker基础与岗位技能准备指南",
                        url="https://docs.docker.com/get-started/",
                        version_or_date="2026-09-13",
                    ),
                ),
                disclaimer="智能建议仅供就业准备参考，不构成录用、资格或期限承诺。",
                handoff_recommended=False,
                mode="mock",
            )

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
    if mode == "unavailable":
        return AssistantResponse(
            answer=(
                "智能咨询服务暂不可用（上游服务响应异常或未就绪）。"
                "涉及求职技能准备、岗位匹配或政策认定，请通过下方【转人工教师】通道联系就业指导教师人工确认。"
                "系统不会据此作出录用、资格或期限承诺。"
            ),
            sources=(),
            disclaimer="智能咨询服务暂不可用，已转为人工确认指引。",
            handoff_recommended=True,
            mode="unavailable",
        )
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
