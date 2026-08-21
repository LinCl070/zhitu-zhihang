"""Deterministic, explainable matching for approved demonstration job postings."""

import re
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from uuid import UUID

from app.models.entities import CareerProfile, JobPosting, JobStatus

SKILL_WEIGHT = 50
MAJOR_WEIGHT = 20
PROJECT_WEIGHT = 15
CITY_WEIGHT = 5
TARGET_ROLE_WEIGHT = 10


@dataclass(frozen=True)
class MatchSource:
    title: str
    url: str | None
    published_on: date
    valid_until: date
    demo_only: bool


@dataclass(frozen=True)
class ScoredJobMatch:
    job_id: UUID
    title: str
    company_name: str
    score: int
    score_breakdown: dict[str, int]
    gaps: list[str]
    source: MatchSource


class MatchingService:
    """Compute rule-based recommendations without model calls or database writes."""

    def match(
        self,
        profile: CareerProfile,
        job_postings: Iterable[JobPosting],
        *,
        as_of: date | None = None,
    ) -> list[ScoredJobMatch]:
        calculation_date = as_of or date.today()
        matches = [
            self._score(profile, job)
            for job in job_postings
            if self._is_eligible(job, calculation_date)
        ]
        return sorted(
            matches,
            key=lambda match: (-match.score, match.source.valid_until, match.title),
        )

    @staticmethod
    def _is_eligible(job: JobPosting, calculation_date: date) -> bool:
        return (
            job.status is JobStatus.PUBLISHED
            and job.valid_until >= calculation_date
            and bool(job.source_title.strip())
        )

    def _score(self, profile: CareerProfile, job: JobPosting) -> ScoredJobMatch:
        normalized_skills = {_normalize(skill) for skill in profile.skills if _normalize(skill)}
        required_skills = [skill for skill in job.required_skills if _normalize(skill)]
        matched_skills = [
            skill for skill in required_skills if _normalize(skill) in normalized_skills
        ]
        gaps = [skill for skill in required_skills if _normalize(skill) not in normalized_skills]

        breakdown = {
            "skills": _weighted_ratio(len(matched_skills), len(required_skills), SKILL_WEIGHT),
            "major": self._major_score(profile, job),
            "projects": self._project_score(profile, job),
            "city": self._city_score(profile, job),
            "target_role": self._target_role_score(profile, job),
        }
        return ScoredJobMatch(
            job_id=job.id,
            title=job.title,
            company_name=job.company_name,
            score=sum(breakdown.values()),
            score_breakdown=breakdown,
            gaps=gaps,
            source=MatchSource(
                title=job.source_title,
                url=job.source_url,
                published_on=job.published_on,
                valid_until=job.valid_until,
                demo_only=job.demo_only,
            ),
        )

    @staticmethod
    def _major_score(profile: CareerProfile, job: JobPosting) -> int:
        preferred_majors = {_normalize(major) for major in job.preferred_majors}
        if "不限" in preferred_majors or _normalize(profile.major) in preferred_majors:
            return MAJOR_WEIGHT
        return 0

    @staticmethod
    def _project_score(profile: CareerProfile, job: JobPosting) -> int:
        if not job.project_signals:
            return 0
        matched_signals = sum(
            _matches_project_signal(signal, profile.projects) for signal in job.project_signals
        )
        return _weighted_ratio(matched_signals, len(job.project_signals), PROJECT_WEIGHT)

    @staticmethod
    def _city_score(profile: CareerProfile, job: JobPosting) -> int:
        target_cities = {_normalize(city) for city in profile.target_cities}
        return CITY_WEIGHT if _normalize(job.city) in target_cities else 0

    @staticmethod
    def _target_role_score(profile: CareerProfile, job: JobPosting) -> int:
        normalized_title = _normalize(job.title)
        for target_role in profile.target_roles:
            normalized_role = _normalize(target_role)
            if normalized_role and (
                normalized_role in normalized_title or normalized_title in normalized_role
            ):
                return TARGET_ROLE_WEIGHT
        return 0


def _normalize(value: str) -> str:
    return " ".join(value.casefold().strip().split())


def _weighted_ratio(matched: int, total: int, weight: int) -> int:
    if total == 0:
        return 0
    return round(weight * matched / total)


def _matches_project_signal(signal: str, projects: list[str]) -> bool:
    normalized_projects = [_normalize(project) for project in projects]
    terms = [_normalize(term) for term in re.split(r"[;；、,/|]|或", signal)]
    return any(term and any(term in project for project in normalized_projects) for term in terms)
