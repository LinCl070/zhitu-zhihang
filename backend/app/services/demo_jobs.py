"""Idempotent loader for approved local demonstration and public job snapshots."""

import csv
from datetime import date
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy.orm import Session

from app.models.entities import JobPosting, JobStatus

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEMO_JOB_CSV = PROJECT_ROOT / "docs" / "data-governance" / "mock-job-postings.csv"
PUBLIC_JOB_CSV = PROJECT_ROOT / "docs" / "data-governance" / "public-job-postings.csv"
DEMO_SOURCE_TITLE = "职途智航模拟岗位数据集"


def ensure_demo_job_postings(session: Session) -> int:
    """Load approved local jobs and return the number of newly inserted records."""

    return _load_csv(session, DEMO_JOB_CSV, is_public=False) + _load_csv(
        session, PUBLIC_JOB_CSV, is_public=True
    )


def _load_csv(session: Session, path: Path, *, is_public: bool) -> int:
    if not path.is_file():
        return 0

    inserted = 0
    with path.open(encoding="utf-8", newline="") as csv_file:
        for row in csv.DictReader(csv_file):
            if is_public and row.get("status") != JobStatus.PUBLISHED.value:
                continue
            dataset_name = "public" if is_public else "demo"
            job_id = uuid5(NAMESPACE_URL, f"cuit-career-{dataset_name}-job:{row['job_id']}")
            if session.get(JobPosting, job_id) is not None:
                continue
            session.add(
                JobPosting(
                    id=job_id,
                    title=row["title"],
                    company_name=row.get("employer_name") or row["employer_alias"],
                    city=row["city"],
                    employment_type=row["employment_type"],
                    required_skills=_tags(row["required_skills"]),
                    preferred_majors=_tags(row["preferred_majors"]),
                    project_signals=_tags(row["project_signals"]),
                    source_title=row.get("source_title") or DEMO_SOURCE_TITLE,
                    source_url=row.get("source_url") or None,
                    published_on=date.fromisoformat(row["published_on"]),
                    valid_until=date.fromisoformat(row["valid_until"]),
                    status=JobStatus(row["status"]),
                    demo_only=row["demo_only"].lower() == "true",
                )
            )
            inserted += 1
    return inserted


def _tags(value: str) -> list[str]:
    return [tag.strip() for tag in value.split(";") if tag.strip()]
