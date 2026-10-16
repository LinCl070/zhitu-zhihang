"""Precomputed scoring that mirrors MatchingService for fast ABM experiments."""

import re
from dataclasses import dataclass

from app.services.matching import (
    CITY_WEIGHT,
    MAJOR_WEIGHT,
    PROJECT_WEIGHT,
    SKILL_WEIGHT,
    TARGET_ROLE_WEIGHT,
    _normalize,
    _weighted_ratio,
)
from app.services.simulation.cohort import JobTemplate, StudentAgent


@dataclass(frozen=True)
class PreparedJob:
    """A job template with precomputed normalized fields for fast scoring."""

    template: JobTemplate
    required_skills: tuple[str, ...]
    preferred_majors: frozenset[str]
    project_terms: tuple[tuple[str, ...], ...]
    city: str


@dataclass(frozen=True)
class ScoreResult:
    score: int
    gaps: tuple[str, ...]


class FastScorer:
    """Score synthetic students against prepared jobs, mirroring MatchingService math."""

    def __init__(self, jobs: list[JobTemplate]) -> None:
        self._jobs = [self._prepare(job) for job in jobs]

    @staticmethod
    def _prepare(job: JobTemplate) -> PreparedJob:
        required_skills = tuple(skill for skill in job.required_skills if _normalize(skill))
        preferred_majors = frozenset(_normalize(major) for major in job.preferred_majors)
        project_terms = tuple(_project_terms(signal) for signal in job.project_signals)
        return PreparedJob(
            template=job,
            required_skills=required_skills,
            preferred_majors=preferred_majors,
            project_terms=project_terms,
            city=_normalize(job.city),
        )

    def best_score(self, agent: StudentAgent, *, all_cities: bool = False) -> ScoreResult:
        """Return the best (score, gaps) across all jobs visible to the agent."""
        best: ScoreResult | None = None
        for job in self._jobs:
            if not all_cities and job.city != _normalize(agent.target_city):
                continue
            result = self._score(agent, job)
            if best is None or result.score > best.score:
                best = result
        if best is None:
            return ScoreResult(score=0, gaps=())
        return best

    def score_job(self, agent: StudentAgent, job: PreparedJob) -> ScoreResult:
        return self._score(agent, job)

    @staticmethod
    def _score(agent: StudentAgent, job: PreparedJob) -> ScoreResult:
        normalized_skills = {_normalize(skill) for skill in agent.skills if _normalize(skill)}
        matched = [skill for skill in job.required_skills if _normalize(skill) in normalized_skills]
        gaps = tuple(
            skill for skill in job.required_skills if _normalize(skill) not in normalized_skills
        )

        skills = _weighted_ratio(len(matched), len(job.required_skills), SKILL_WEIGHT)
        major = (
            MAJOR_WEIGHT
            if "不限" in job.preferred_majors or _normalize(agent.major) in job.preferred_majors
            else 0
        )
        projects = _project_score(agent.projects, job.project_terms)
        city = CITY_WEIGHT if _normalize(agent.target_city) in job.city else 0
        target_role = _target_role_score(agent.target_role, job.template.title)

        score = skills + major + projects + city + target_role
        return ScoreResult(score=score, gaps=gaps)


def _project_terms(signal: str) -> tuple[str, ...]:
    return tuple(
        _normalize(term)
        for term in re.split(r"[;；、,/|]|或", signal)
        if _normalize(term)
    )


def _project_score(projects: list[str], project_terms: tuple[tuple[str, ...], ...]) -> int:
    if not project_terms:
        return 0
    normalized_projects = [_normalize(project) for project in projects]
    matched_signals = sum(
        any(term in project for term in terms for project in normalized_projects)
        for terms in project_terms
    )
    return _weighted_ratio(matched_signals, len(project_terms), PROJECT_WEIGHT)


def _target_role_score(target_role: str, title: str) -> int:
    normalized_title = _normalize(title)
    normalized_role = _normalize(target_role)
    if normalized_role and (
        normalized_role in normalized_title or normalized_title in normalized_role
    ):
        return TARGET_ROLE_WEIGHT
    return 0
