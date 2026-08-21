"""Transactional services for profiles, rule matches, and safe action plans."""

from dataclasses import dataclass
from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    ActionPlan,
    CareerProfile,
    JobPosting,
    JobStage,
    MatchResult,
    PlanStatus,
)
from app.services.demo_jobs import ensure_demo_job_postings
from app.services.matching import MatchingService, ScoredJobMatch


@dataclass(frozen=True)
class StoredMatch:
    id: UUID
    match: ScoredJobMatch


def upsert_career_profile(
    session: Session,
    *,
    student_id: UUID,
    major: str,
    skills: list[str],
    projects: list[str],
    target_roles: list[str],
    target_cities: list[str],
    job_stage: JobStage,
) -> CareerProfile:
    profile = session.scalar(select(CareerProfile).where(CareerProfile.student_id == student_id))
    if profile is None:
        profile = CareerProfile(student_id=student_id)
        session.add(profile)
    profile.major = major
    profile.skills = skills
    profile.projects = projects
    profile.target_roles = target_roles
    profile.target_cities = target_cities
    profile.job_stage = job_stage
    session.flush()
    return profile


def create_matches(
    session: Session, profile: CareerProfile, *, limit: int, as_of: date | None = None
) -> list[StoredMatch]:
    ensure_demo_job_postings(session)
    session.flush()
    job_postings = session.scalars(select(JobPosting)).all()
    scored_matches = MatchingService().match(profile, job_postings, as_of=as_of)[:limit]
    stored_matches: list[StoredMatch] = []
    for scored_match in scored_matches:
        record = MatchResult(
            profile_id=profile.id,
            job_id=scored_match.job_id,
            score=scored_match.score,
            score_breakdown=scored_match.score_breakdown,
            gaps=scored_match.gaps,
        )
        session.add(record)
        session.flush()
        stored_matches.append(StoredMatch(id=record.id, match=scored_match))
    return stored_matches


def get_owned_match(session: Session, *, match_id: UUID, student_id: UUID) -> MatchResult | None:
    return session.scalar(
        select(MatchResult)
        .join(CareerProfile, MatchResult.profile_id == CareerProfile.id)
        .where(MatchResult.id == match_id, CareerProfile.student_id == student_id)
    )


def build_action_plan_items(gaps: list[str]) -> list[dict[str, str]]:
    gap_text = "、".join(gaps) if gaps else "岗位核心技能"
    return [
        {
            "phase": "本周",
            "priority": "高",
            "task": "核对岗位来源、有效期与自身求职意向。",
        },
        {
            "phase": "两周内",
            "priority": "高",
            "task": f"围绕 {gap_text} 制定可验证的学习或项目补强计划。",
        },
        {
            "phase": "投递前",
            "priority": "中",
            "task": "仅梳理真实经历，完善简历并向就业指导教师确认材料。",
        },
    ]


def create_action_plan(session: Session, *, student_id: UUID, match: MatchResult) -> ActionPlan:
    plan = ActionPlan(
        student_id=student_id,
        match_id=match.id,
        items=build_action_plan_items(match.gaps),
        status=PlanStatus.ACTIVE,
    )
    session.add(plan)
    session.flush()
    return plan
