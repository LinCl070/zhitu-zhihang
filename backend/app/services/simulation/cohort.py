"""Synthetic student cohort and job-market generation for ABM experiments."""

import csv
import math
from dataclasses import dataclass
from pathlib import Path
from random import Random

from app.models.entities import JobStage

PROJECT_ROOT = Path(__file__).resolve().parents[4]
MOCK_JOB_CSV = PROJECT_ROOT / "docs" / "data-governance" / "mock-job-postings.csv"
PUBLIC_JOB_CSV = PROJECT_ROOT / "docs" / "data-governance" / "public-job-postings.csv"

STAGE_WEIGHTS = [("exploring", 0.5), ("preparing", 0.35), ("applying", 0.15)]


@dataclass(frozen=True)
class JobTemplate:
    title: str
    city: str
    required_skills: tuple[str, ...]
    preferred_majors: tuple[str, ...]
    project_signals: tuple[str, ...]
    capacity: int


@dataclass
class StudentAgent:
    id: str
    major: str
    skills: list[str]
    projects: list[str]
    target_role: str
    target_city: str
    city_flex: float
    learning_rate: float
    initiative: float
    stage: JobStage
    months_to_graduation: float
    matched: bool = False
    best_match_score: int = 0
    best_match_gaps: tuple[str, ...] = ()


def load_job_templates(cohort_size: int, supply_ratio: float = 0.8) -> list[JobTemplate]:
    """Load published job postings and assign per-template capacity based on supply_ratio."""
    templates = _read_templates()
    if not templates:
        return []
    capacity = math.ceil(cohort_size * supply_ratio / len(templates))
    return [
        JobTemplate(
            title=template.title,
            city=template.city,
            required_skills=template.required_skills,
            preferred_majors=template.preferred_majors,
            project_signals=template.project_signals,
            capacity=capacity,
        )
        for template in templates
    ]


def _read_templates() -> list[JobTemplate]:
    templates: list[JobTemplate] = []
    for path in (MOCK_JOB_CSV, PUBLIC_JOB_CSV):
        if not path.is_file():
            continue
        with path.open(encoding="utf-8-sig", newline="") as csv_file:
            for row in csv.DictReader(csv_file):
                if row.get("status") != "published":
                    continue
                templates.append(
                    JobTemplate(
                        title=row["title"],
                        city=row["city"],
                        required_skills=_split(row["required_skills"]),
                        preferred_majors=_split(row["preferred_majors"]),
                        project_signals=_split(row["project_signals"]),
                        capacity=0,
                    )
                )
    return templates


def _split(value: str) -> tuple[str, ...]:
    return tuple(tag.strip() for tag in value.split(";") if tag.strip())


def generate_cohort(
    cohort_size: int,
    seed: int,
    *,
    months_to_graduation_start: float = 10.0,
    learning_rate: float | None = None,
) -> list[StudentAgent]:
    """Generate a deterministic synthetic cohort. Same seed yields the same cohort."""
    templates = load_job_templates(cohort_size)
    rng = Random(seed)

    majors_pool = _majors_pool(templates)
    global_skill_pool = _global_skill_pool(templates)
    related_skills = _related_skills_map(templates)

    agents: list[StudentAgent] = []
    for index in range(cohort_size):
        major = rng.choice(majors_pool) if majors_pool else "未分类"
        related = related_skills.get(major, global_skill_pool)
        skill_count = rng.randint(2, 5)
        skills: list[str] = []
        candidates = sorted(set(related) | set(global_skill_pool))
        if candidates:
            attempts = 0
            while len(skills) < skill_count and attempts < skill_count * 20:
                attempts += 1
                if rng.random() < 0.6 and related:
                    candidate = rng.choice(related)
                else:
                    candidate = rng.choice(global_skill_pool)
                if candidate not in skills:
                    skills.append(candidate)

        project_pool = _project_pool_for(major, templates)
        projects = (
            [rng.choice(project_pool) for _ in range(rng.randint(0, 2))] if project_pool else []
        )

        template = rng.choice(templates) if templates else None
        target_role = template.title if template else "通用岗位"
        target_city = template.city if template else "成都"

        stage = JobStage(_weighted_choice(rng, STAGE_WEIGHTS))
        agents.append(
            StudentAgent(
                id=f"syn-{index}",
                major=major,
                skills=skills,
                projects=projects,
                target_role=target_role,
                target_city=target_city,
                city_flex=rng.uniform(0, 1),
                learning_rate=(
                    learning_rate if learning_rate is not None else rng.uniform(0.15, 0.45)
                ),
                initiative=rng.uniform(0.3, 0.9),
                stage=stage,
                months_to_graduation=months_to_graduation_start,
            )
        )
    return agents


def _majors_pool(templates: list[JobTemplate]) -> list[str]:
    majors: set[str] = set()
    for template in templates:
        for major in template.preferred_majors:
            if major != "不限":
                majors.add(major)
    return sorted(majors)


def _global_skill_pool(templates: list[JobTemplate]) -> list[str]:
    skills: set[str] = set()
    for template in templates:
        skills.update(template.required_skills)
    return sorted(skills)


def _related_skills_map(templates: list[JobTemplate]) -> dict[str, list[str]]:
    mapping: dict[str, list[str]] = {}
    for template in templates:
        for major in template.preferred_majors:
            if major == "不限":
                continue
            mapping.setdefault(major, [])
            for skill in template.required_skills:
                if skill not in mapping[major]:
                    mapping[major].append(skill)
    return mapping


def _project_pool_for(major: str, templates: list[JobTemplate]) -> list[str]:
    projects: list[str] = []
    for template in templates:
        if major in template.preferred_majors:
            projects.extend(template.project_signals)
    return sorted(set(projects))


def _weighted_choice(rng: Random, weighted: list[tuple[str, float]]) -> str:
    total = sum(weight for _, weight in weighted)
    threshold = rng.uniform(0, total)
    cumulative = 0.0
    for value, weight in weighted:
        cumulative += weight
        if threshold <= cumulative:
            return value
    return weighted[-1][0]
