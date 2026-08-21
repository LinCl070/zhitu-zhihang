import unittest
from uuid import UUID

from app.api.career import CareerProfilePayload
from app.models.entities import JobPosting
from app.services.career import build_action_plan_items
from app.services.demo_jobs import ensure_demo_job_postings
from pydantic import ValidationError


class FakeJobSession:
    def __init__(self) -> None:
        self.jobs: dict[UUID, JobPosting] = {}

    def get(self, model: type[JobPosting], job_id: UUID) -> JobPosting | None:
        return self.jobs.get(job_id)

    def add(self, job: JobPosting) -> None:
        self.jobs[job.id] = job


class CareerServiceTests(unittest.TestCase):
    def test_local_job_snapshots_are_idempotent_and_preserve_source_boundaries(self) -> None:
        session = FakeJobSession()

        first_load = ensure_demo_job_postings(session)
        second_load = ensure_demo_job_postings(session)

        self.assertEqual(first_load, 30)
        self.assertEqual(second_load, 0)
        self.assertEqual(sum(not job.demo_only for job in session.jobs.values()), 20)
        self.assertTrue(all(job.source_url for job in session.jobs.values() if not job.demo_only))
        self.assertTrue(all(job.source_title for job in session.jobs.values()))

    def test_action_plan_refers_to_gaps_without_claiming_an_outcome(self) -> None:
        items = build_action_plan_items(["Docker", "Linux"])

        self.assertEqual(len(items), 3)
        self.assertIn("Docker、Linux", items[1]["task"])
        self.assertNotIn("录用", " ".join(item["task"] for item in items))

    def test_profile_payload_rejects_extra_and_duplicate_input(self) -> None:
        with self.assertRaises(ValidationError):
            CareerProfilePayload(
                major="Software Engineering",
                skills=["Python", "Python"],
                projects=["Verified project"],
                target_roles=["Backend Developer"],
                target_cities=["Chengdu"],
                job_stage="preparing",
                phone="not allowed",
            )
