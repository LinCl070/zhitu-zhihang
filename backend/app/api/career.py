"""Student-facing API routes for the career-planning demonstration flow."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.demo import (
    DbSession,
    SessionPrincipal,
    get_current_principal,
    require_roles,
)
from app.clients.fastgpt import AssistantRoute
from app.config import get_settings
from app.models.entities import CareerProfile, JobStage, UserRole
from app.services.assistant import create_assistant_service
from app.services.audit import record_audit_event
from app.services.career import (
    StoredMatch,
    create_action_plan,
    create_matches,
    get_owned_match,
    upsert_career_profile,
)

router = APIRouter(prefix="/api/v1", tags=["career"])
StudentPrincipal = Annotated[SessionPrincipal, Depends(require_roles(UserRole.STUDENT))]
AnyDemoPrincipal = Annotated[SessionPrincipal, Depends(get_current_principal)]


class CareerProfilePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    major: str = Field(min_length=1, max_length=100)
    skills: list[str] = Field(min_length=1, max_length=20)
    projects: list[str] = Field(min_length=1, max_length=10)
    target_roles: list[str] = Field(min_length=1, max_length=10)
    target_cities: list[str] = Field(min_length=1, max_length=10)
    job_stage: JobStage

    @field_validator("major")
    @classmethod
    def normalize_major(cls, value: str) -> str:
        return _normalize_text(value, 100)

    @field_validator("skills", "target_roles", "target_cities")
    @classmethod
    def normalize_tags(cls, values: list[str]) -> list[str]:
        return _normalize_list(values, 100)

    @field_validator("projects")
    @classmethod
    def normalize_projects(cls, values: list[str]) -> list[str]:
        return _normalize_list(values, 500)


class CareerProfileResponse(CareerProfilePayload):
    id: UUID
    student_id: UUID


class MatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    limit: int = Field(default=10, ge=3, le=10)


class SourceResponse(BaseModel):
    title: str
    url: str | None
    published_on: str
    valid_until: str
    demo_only: bool = True


class MatchResponse(BaseModel):
    id: UUID
    job_id: UUID
    title: str
    company_name: str
    score: int
    score_breakdown: dict[str, int]
    gaps: list[str]
    source: SourceResponse


class MatchesResponse(BaseModel):
    matches: list[MatchResponse]
    handoff_recommended: bool
    message: str | None = None


class ActionPlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    match_id: UUID


class ActionPlanResponse(BaseModel):
    id: UUID
    match_id: UUID
    status: str
    items: list[dict[str, str]]


class AssistantQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    consultation_type: Literal["career", "policy"]
    question: str = Field(min_length=1, max_length=500)

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        return _normalize_text(value, 500)


class AssistantSourceResponse(BaseModel):
    title: str
    url: str | None
    version_or_date: str | None


class AssistantQueryResponse(BaseModel):
    answer: str
    sources: list[AssistantSourceResponse]
    disclaimer: str
    handoff_recommended: bool
    mode: str


@router.put("/career-profile/me", response_model=CareerProfileResponse)
def save_career_profile(
    payload: CareerProfilePayload,
    principal: StudentPrincipal,
    session: DbSession,
) -> CareerProfileResponse:
    profile = upsert_career_profile(session, student_id=principal.user_id, **payload.model_dump())
    record_audit_event(
        session,
        actor_id=principal.user_id,
        actor_role=principal.role,
        action="career_profile_saved",
        resource_type="career_profile",
        resource_id=profile.id,
    )
    session.commit()
    return _profile_response(profile)


@router.get("/career-profile/me", response_model=CareerProfileResponse)
def read_career_profile(principal: StudentPrincipal, session: DbSession) -> CareerProfileResponse:
    profile = _get_profile(session, principal.user_id)
    return _profile_response(profile)


@router.post("/matches", response_model=MatchesResponse)
def generate_matches(
    payload: MatchRequest,
    principal: StudentPrincipal,
    session: DbSession,
) -> MatchesResponse:
    profile = _get_profile(session, principal.user_id)
    matches = create_matches(session, profile, limit=payload.limit)
    record_audit_event(
        session,
        actor_id=principal.user_id,
        actor_role=principal.role,
        action="matches_generated",
        resource_type="career_profile",
        resource_id=profile.id,
    )
    session.commit()
    if not matches:
        return MatchesResponse(
            matches=[],
            handoff_recommended=True,
            message="当前没有可推荐的有效岗位，请联系就业指导教师确认。",
        )
    return MatchesResponse(
        matches=[_match_response(item) for item in matches],
        handoff_recommended=False,
    )


@router.post(
    "/action-plans",
    response_model=ActionPlanResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_action_plan(
    payload: ActionPlanRequest,
    principal: StudentPrincipal,
    session: DbSession,
) -> ActionPlanResponse:
    match = get_owned_match(session, match_id=payload.match_id, student_id=principal.user_id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match result not found")
    plan = create_action_plan(session, student_id=principal.user_id, match=match)
    record_audit_event(
        session,
        actor_id=principal.user_id,
        actor_role=principal.role,
        action="action_plan_created",
        resource_type="action_plan",
        resource_id=plan.id,
    )
    session.commit()
    return ActionPlanResponse(
        id=plan.id,
        match_id=plan.match_id,
        status=plan.status.value,
        items=plan.items,
    )


@router.post("/assistant/query", response_model=AssistantQueryResponse)
async def query_assistant(
    payload: AssistantQueryRequest,
    principal: AnyDemoPrincipal,
    session: DbSession,
) -> AssistantQueryResponse:
    context = _assistant_context(session, principal)
    response = await create_assistant_service(get_settings()).query(
        AssistantRoute(payload.consultation_type),
        payload.question,
        context,
    )
    record_audit_event(
        session,
        actor_id=principal.user_id,
        actor_role=principal.role,
        action="assistant_queried",
        resource_type="assistant",
        resource_id=None,
    )
    session.commit()
    return AssistantQueryResponse(
        answer=response.answer,
        sources=[
            AssistantSourceResponse(
                title=source.title,
                url=source.url,
                version_or_date=source.version_or_date,
            )
            for source in response.sources
        ],
        disclaimer=response.disclaimer,
        handoff_recommended=response.handoff_recommended,
        mode=response.mode,
    )


def _get_profile(session: Session, student_id: UUID) -> CareerProfile:
    profile = session.scalar(select(CareerProfile).where(CareerProfile.student_id == student_id))
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Complete a career profile before using this feature",
        )
    return profile


def _assistant_context(session: Session, principal: SessionPrincipal) -> dict[str, object]:
    if principal.role is not UserRole.STUDENT:
        return {"role": principal.role.value}
    profile = session.scalar(
        select(CareerProfile).where(CareerProfile.student_id == principal.user_id)
    )
    if profile is None:
        return {"role": principal.role.value}
    return {
        "role": principal.role.value,
        "major": profile.major,
        "target_roles": profile.target_roles,
        "target_cities": profile.target_cities,
    }


def _profile_response(profile: CareerProfile) -> CareerProfileResponse:
    return CareerProfileResponse(
        id=profile.id,
        student_id=profile.student_id,
        major=profile.major,
        skills=profile.skills,
        projects=profile.projects,
        target_roles=profile.target_roles,
        target_cities=profile.target_cities,
        job_stage=profile.job_stage,
    )


def _match_response(stored_match: StoredMatch) -> MatchResponse:
    match = stored_match.match
    return MatchResponse(
        id=stored_match.id,
        job_id=match.job_id,
        title=match.title,
        company_name=match.company_name,
        score=match.score,
        score_breakdown=match.score_breakdown,
        gaps=match.gaps,
        source=SourceResponse(
            title=match.source.title,
            url=match.source.url,
            published_on=match.source.published_on.isoformat(),
            valid_until=match.source.valid_until.isoformat(),
            demo_only=match.source.demo_only,
        ),
    )


def _normalize_text(value: str, maximum_length: int) -> str:
    normalized = " ".join(value.strip().split())
    if not normalized or len(normalized) > maximum_length:
        raise ValueError("Value must contain visible text within the allowed length")
    return normalized


def _normalize_list(values: list[str], maximum_length: int) -> list[str]:
    normalized = [_normalize_text(value, maximum_length) for value in values]
    if len(set(normalized)) != len(normalized):
        raise ValueError("List values must be unique")
    return normalized
