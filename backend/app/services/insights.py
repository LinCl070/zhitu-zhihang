"""Aggregated, de-identified cohort insights with small-sample suppression."""

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import CareerProfile, JobPosting, User
from app.services.risk import RiskInput, assess_risk
from app.services.simulation.cohort import generate_cohort, load_job_templates
from app.services.simulation.scoring import FastScorer

SMALL_SAMPLE_THRESHOLD = 5
OTHER_GROUP = "其他（小样本已合并）"


def build_insights(
    session: Session,
    *,
    source: str,
    seed: int = 1,
    cohort_size: int = 300,
) -> dict[str, object]:
    """Return aggregated insights for live students or a synthetic cohort."""
    if source == "synthetic":
        return _synthetic_insights(seed, cohort_size)
    return _live_insights(session)


def _live_insights(session: Session) -> dict[str, object]:
    profiles = session.scalars(select(CareerProfile)).all()
    users = {user.id: user for user in session.scalars(select(User)).all()}
    job_postings = session.scalars(select(JobPosting)).all()

    rows: list[dict[str, object]] = []
    for profile in profiles:
        user = users.get(profile.student_id)
        if user is None or user.role.value != "student":
            continue
        from app.services.matching import MatchingService

        matches = MatchingService().match(profile, job_postings)
        best = matches[0] if matches else None
        risk = assess_risk(
            RiskInput(
                has_profile=True,
                skill_count=len(profile.skills),
                project_count=len(profile.projects),
                job_stage=profile.job_stage,
                best_match_score=best.score if best else None,
                best_match_gap_count=len(best.gaps) if best else 0,
                best_match_gaps=tuple(best.gaps) if best else (),
                has_plan=True,
                days_since_update=None,
                months_to_graduation=None,
            )
        )
        rows.append(
            {
                "major": profile.major,
                "stage": profile.job_stage.value,
                "risk_level": risk.level,
                "readiness": best.score if best else 0,
            }
        )

    return _aggregate(rows, source="live")


def _synthetic_insights(seed: int, cohort_size: int) -> dict[str, object]:
    agents = generate_cohort(cohort_size, seed)
    jobs = load_job_templates(cohort_size)
    scorer = FastScorer(jobs)
    rows: list[dict[str, object]] = []
    for agent in agents:
        best = scorer.best_score(agent, all_cities=True)
        risk = assess_risk(
            RiskInput(
                has_profile=True,
                skill_count=len(agent.skills),
                project_count=len(agent.projects),
                job_stage=agent.stage,
                best_match_score=best.score,
                best_match_gap_count=len(best.gaps),
                best_match_gaps=best.gaps,
                has_plan=True,
                days_since_update=0,
                months_to_graduation=max(0, round(agent.months_to_graduation)),
            )
        )
        rows.append(
            {
                "major": agent.major,
                "stage": agent.stage.value,
                "risk_level": risk.level,
                "readiness": best.score,
            }
        )
    return _aggregate(rows, source="synthetic")


def _aggregate(rows: list[dict[str, object]], *, source: str) -> dict[str, object]:
    groups: list[dict[str, object]] = []
    by_major_stage: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        by_major_stage[(str(row["major"]), str(row["stage"]))].append(row)

    merged: dict[str, list[dict[str, object]]] = defaultdict(list)
    for (major, stage), members in by_major_stage.items():
        if len(members) < SMALL_SAMPLE_THRESHOLD:
            merged[("其他", stage)].extend(members)
        else:
            merged[(major, stage)].extend(members)

    for (major, stage), members in sorted(merged.items()):
        if len(members) < SMALL_SAMPLE_THRESHOLD:
            continue
        readiness_values = [int(m["readiness"]) for m in members]
        risk_levels = [str(m["risk_level"]) for m in members]
        groups.append(
            {
                "major": major,
                "stage": stage,
                "count": len(members),
                "readiness_mean": round(sum(readiness_values) / len(readiness_values), 1),
                "risk_distribution": {
                    level: risk_levels.count(level) for level in ("high", "medium", "low")
                },
            }
        )

    return {
        "source": source,
        "synthetic": source == "synthetic",
        "groups": groups,
        "total_count": len(rows),
    }
