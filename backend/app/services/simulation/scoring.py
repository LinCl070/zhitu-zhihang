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
    normalized_required_skills: tuple[str, ...]
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
        normalized_required_skills = tuple(
            _normalize(skill) for skill in required_skills
        )
        preferred_majors = frozenset(_normalize(major) for major in job.preferred_majors)
        project_terms = tuple(_project_terms(signal) for signal in job.project_signals)
        return PreparedJob(
            template=job,
            required_skills=required_skills,
            normalized_required_skills=normalized_required_skills,
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

    def top_jobs(
        self,
        agent: StudentAgent,
        *,
        all_cities: bool,
        k: int,
        capacities: dict[int, int] | None = None,
    ) -> list[tuple[int, int]]:
        """Return up to ``k`` visible jobs as (index, score), highest score first.

        Precomputes the agent-level normalized fields once so the per-job scoring
        loop does not re-normalize the agent's skills/major/city on every job.
        Jobs whose capacity (from ``capacities``) is exhausted are skipped.
        """
        normalized_skills = {_normalize(skill) for skill in agent.skills if _normalize(skill)}
        normalized_major = _normalize(agent.major)
        normalized_city = _normalize(agent.target_city)
        normalized_projects = [_normalize(project) for project in agent.projects]
        scored: list[tuple[int, int]] = []
        for index, job in enumerate(self._jobs):
            if not all_cities and job.city != normalized_city:
                continue
            if capacities is not None and capacities.get(index, 0) <= 0:
                continue
            score = self._score_precomputed(
                agent, job, normalized_skills, normalized_major, normalized_city,
                normalized_projects,
            ).score
            scored.append((index, score))
        scored.sort(key=lambda item: item[1], reverse=True)
        return scored[:k]

    @staticmethod
    def _score(agent: StudentAgent, job: PreparedJob) -> ScoreResult:
        normalized_skills = {_normalize(skill) for skill in agent.skills if _normalize(skill)}
        return FastScorer._score_precomputed(
            agent,
            job,
            normalized_skills,
            _normalize(agent.major),
            _normalize(agent.target_city),
            [_normalize(project) for project in agent.projects],
        )

    @staticmethod
    def _score_precomputed(
        agent: StudentAgent,
        job: PreparedJob,
        normalized_skills: set[str],
        normalized_major: str,
        normalized_city: str,
        normalized_projects: list[str],
    ) -> ScoreResult:
        matched = [
            original
            for original, normalized in zip(
                job.required_skills, job.normalized_required_skills, strict=True
            )
            if normalized in normalized_skills
        ]
        gaps = tuple(
            original
            for original, normalized in zip(
                job.required_skills, job.normalized_required_skills, strict=True
            )
            if normalized not in normalized_skills
        )

        skills = _weighted_ratio(len(matched), len(job.required_skills), SKILL_WEIGHT)
        major = (
            MAJOR_WEIGHT
            if "不限" in job.preferred_majors or normalized_major in job.preferred_majors
            else 0
        )
        projects = _project_score_precomputed(normalized_projects, job.project_terms)
        city = CITY_WEIGHT if normalized_city in job.city else 0
        target_role = _target_role_score(agent.target_role, job.template.title)

        score = skills + major + projects + city + target_role
        return ScoreResult(score=score, gaps=gaps)


def _project_terms(signal: str) -> tuple[str, ...]:
    return tuple(
        _normalize(term)
        for term in re.split(r"[;；、,/|]|或", signal)
        if _normalize(term)
    )


def _project_score_precomputed(
    normalized_projects: list[str], project_terms: tuple[tuple[str, ...], ...]
) -> int:
    if not project_terms:
        return 0
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
