"""Deterministic, explainable employment-readiness risk model shared by live and simulated agents.
"""

from dataclasses import dataclass
from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import ActionPlan, CareerProfile, JobPosting, JobStage, User
from app.services.matching import MatchingService

# Factor weights sum to 100.
PROFILE_WEIGHT = 25
MATCH_WEIGHT = 25
GAP_WEIGHT = 15
STAGE_WEIGHT = 20
PLAN_WEIGHT = 10
STALE_WEIGHT = 5

HIGH_THRESHOLD = 60
MEDIUM_THRESHOLD = 35

READINESS_SCORE = 70
STALE_DAYS = 30

_PROFILE_SKILL_MIN = 3
_GAP_PER_SKILL = 5


@dataclass(frozen=True)
class RiskInput:
    """Pure, ORM-free risk input. Must never carry sensitive account fields."""

    has_profile: bool
    skill_count: int
    project_count: int
    job_stage: JobStage | None
    best_match_score: int | None
    best_match_gap_count: int
    best_match_gaps: tuple[str, ...]
    has_plan: bool
    days_since_update: int | None
    months_to_graduation: int | None


@dataclass(frozen=True)
class RiskAssessment:
    score: int
    level: str
    factors: dict[str, int]
    reasons: list[str]
    actions: list[str]


def assess_risk(inp: RiskInput) -> RiskAssessment:
    """Compute the risk score, level, and intervention list from a pure RiskInput."""
    factors = {
        "profile": _profile_factor(inp),
        "match": _match_factor(inp),
        "gap": _gap_factor(inp),
        "stage": _stage_factor(inp),
        "plan": _plan_factor(inp),
        "stale": _stale_factor(inp),
    }
    score = sum(factors.values())
    level = "high" if score >= HIGH_THRESHOLD else "medium" if score >= MEDIUM_THRESHOLD else "low"
    reasons = _reasons(inp, factors)
    actions = _actions(inp, factors)
    return RiskAssessment(
        score=score, level=level, factors=factors, reasons=reasons, actions=actions
    )


def _profile_factor(inp: RiskInput) -> int:
    if not inp.has_profile:
        return PROFILE_WEIGHT
    if inp.skill_count < _PROFILE_SKILL_MIN or inp.project_count == 0:
        return 10
    return 0


def _match_factor(inp: RiskInput) -> int:
    if inp.best_match_score is None:
        return MATCH_WEIGHT
    if inp.best_match_score >= READINESS_SCORE:
        return 0
    if inp.best_match_score >= 50:
        return 12
    return MATCH_WEIGHT


def _gap_factor(inp: RiskInput) -> int:
    return min(GAP_WEIGHT, _GAP_PER_SKILL * inp.best_match_gap_count)


def _stage_factor(inp: RiskInput) -> int:
    months = inp.months_to_graduation
    if inp.job_stage is JobStage.EXPLORING:
        if months is None:
            return 10
        if months <= 12:
            return STAGE_WEIGHT
        return 0
    if inp.job_stage is JobStage.PREPARING:
        if months is not None and months <= 6:
            return 12
        return 0
    return 0


def _plan_factor(inp: RiskInput) -> int:
    return PLAN_WEIGHT if not inp.has_plan else 0


def _stale_factor(inp: RiskInput) -> int:
    if inp.days_since_update is not None and inp.days_since_update > STALE_DAYS:
        return STALE_WEIGHT
    return 0


def _reasons(inp: RiskInput, factors: dict[str, int]) -> list[str]:
    reasons: list[str] = []
    if factors["profile"]:
        if not inp.has_profile:
            reasons.append("尚未完善职业画像，缺少专业、技能与求职意向信息。")
        else:
            reasons.append("职业画像信息不完整（技能或项目经历不足）。")
    if factors["match"]:
        if inp.best_match_score is None:
            reasons.append("当前没有可匹配的已发布岗位。")
        else:
            reasons.append(f"当前最高岗位匹配分为 {inp.best_match_score}，低于准备达标线。")
    if factors["gap"]:
        gaps = "、".join(inp.best_match_gaps[:3])
        reasons.append(f"目标岗位存在技能缺口：{gaps}。")
    if factors["stage"]:
        reasons.append("求职阶段推进滞后于毕业时间节点。")
    if factors["plan"]:
        reasons.append("尚未生成行动计划。")
    if factors["stale"]:
        reasons.append("职业画像超过 30 天未更新。")
    return reasons


def _actions(inp: RiskInput, factors: dict[str, int]) -> list[str]:
    actions: list[str] = []
    if factors["profile"]:
        actions.append("提醒完善职业画像。")
    if factors["match"]:
        actions.append("组织岗位方向咨询。")
    if factors["gap"]:
        gaps = "、".join(inp.best_match_gaps[:3])
        actions.append(f"推荐技能补强资源：{gaps}。")
    if factors["stage"]:
        actions.append("安排一对一生涯面谈。")
    if factors["plan"]:
        actions.append("督促生成行动计划。")
    if factors["stale"]:
        actions.append("跟进近况。")
    return actions


def build_risk_input(session: Session, user: User, as_of: date) -> RiskInput:
    """Build a RiskInput for a real student from the live database state."""
    profile = session.scalar(select(CareerProfile).where(CareerProfile.student_id == user.id))
    if profile is None:
        return RiskInput(
            has_profile=False,
            skill_count=0,
            project_count=0,
            job_stage=None,
            best_match_score=None,
            best_match_gap_count=0,
            best_match_gaps=(),
            has_plan=_has_plan(session, user.id),
            days_since_update=None,
            months_to_graduation=_months_to_graduation(user, as_of),
        )

    job_postings = session.scalars(select(JobPosting)).all()
    matches = MatchingService().match(profile, job_postings, as_of=as_of)
    best = matches[0] if matches else None
    days_since_update = (as_of - profile.updated_at.date()).days

    return RiskInput(
        has_profile=True,
        skill_count=len(profile.skills),
        project_count=len(profile.projects),
        job_stage=profile.job_stage,
        best_match_score=best.score if best else None,
        best_match_gap_count=len(best.gaps) if best else 0,
        best_match_gaps=tuple(best.gaps) if best else (),
        has_plan=_has_plan(session, user.id),
        days_since_update=days_since_update,
        months_to_graduation=_months_to_graduation(user, as_of),
    )


def _has_plan(session: Session, student_id: UUID) -> bool:
    return (
        session.scalar(select(ActionPlan.id).where(ActionPlan.student_id == student_id))
        is not None
    )


def _months_to_graduation(user: User, as_of: date) -> int | None:
    graduation = _graduation_date(user)
    if graduation is None:
        return None
    months = (graduation.year - as_of.year) * 12 + (graduation.month - as_of.month)
    if graduation.day > as_of.day:
        months += 1
    return months


def _graduation_date(user: User) -> date | None:
    if user.enrollment_date is not None:
        return date(user.enrollment_date.year + 4, 7, 1)
    if user.enrollment_year is not None:
        return date(user.enrollment_year + 4, 7, 1)
    return None
