import unittest
from datetime import date
from uuid import uuid4

from app.models.entities import CareerProfile, JobPosting, JobStage, JobStatus
from app.services.matching import MatchingService


class MatchingServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = MatchingService()
        self.profile = CareerProfile(
            id=uuid4(),
            student_id=uuid4(),
            major="Software Engineering",
            skills=["Python", "SQL", "Git", "REST API"],
            projects=["API design project"],
            target_roles=["Backend Developer"],
            target_cities=["Chengdu"],
            job_stage=JobStage.PREPARING,
        )
        self.as_of = date(2026, 7, 23)

    def test_matching_returns_explainable_full_score_for_an_exact_match(self) -> None:
        job = self._job(
            required_skills=["Python", "SQL", "Git", "REST API"],
            preferred_majors=["Software Engineering"],
            project_signals=["API design"],
        )

        result = self.service.match(self.profile, [job], as_of=self.as_of)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].score, 100)
        self.assertEqual(
            result[0].score_breakdown,
            {"skills": 50, "major": 20, "projects": 15, "city": 5, "target_role": 10},
        )
        self.assertEqual(result[0].gaps, [])
        self.assertEqual(result[0].source.title, "Approved demo source")
        self.assertTrue(result[0].source.demo_only)

    def test_matching_preserves_the_public_job_marker(self) -> None:
        public_job = self._job(demo_only=False)

        result = self.service.match(self.profile, [public_job], as_of=self.as_of)

        self.assertFalse(result[0].source.demo_only)

    def test_matching_excludes_draft_expired_and_sourceless_jobs(self) -> None:
        valid_job = self._job(title="Valid role")
        draft_job = self._job(title="Draft role", status=JobStatus.DRAFT)
        expired_job = self._job(title="Expired role", valid_until=date(2026, 7, 22))
        sourceless_job = self._job(title="Sourceless role", source_title=" ")

        result = self.service.match(
            self.profile,
            [valid_job, draft_job, expired_job, sourceless_job],
            as_of=self.as_of,
        )

        self.assertEqual([match.title for match in result], ["Valid role"])

    def test_matching_reports_skill_gaps_and_uses_stable_ordering(self) -> None:
        first_job = self._job(
            title="A Backend Developer",
            required_skills=["Python", "Docker"],
            valid_until=date(2026, 12, 31),
        )
        second_job = self._job(
            title="B Backend Developer",
            required_skills=["Python", "Docker"],
            valid_until=date(2026, 12, 31),
        )

        result = self.service.match(self.profile, [second_job, first_job], as_of=self.as_of)

        self.assertEqual(
            [match.title for match in result],
            ["A Backend Developer", "B Backend Developer"],
        )
        self.assertEqual(result[0].gaps, ["Docker"])
        self.assertEqual(result[0].score_breakdown["skills"], 25)

    @staticmethod
    def _job(
        *,
        title: str = "Backend Developer Intern",
        required_skills: list[str] | None = None,
        preferred_majors: list[str] | None = None,
        project_signals: list[str] | None = None,
        status: JobStatus = JobStatus.PUBLISHED,
        valid_until: date = date(2026, 12, 31),
        source_title: str = "Approved demo source",
        demo_only: bool = True,
    ) -> JobPosting:
        return JobPosting(
            id=uuid4(),
            title=title,
            company_name="Demo employer",
            city="Chengdu",
            employment_type="Internship",
            required_skills=required_skills or ["Python"],
            preferred_majors=preferred_majors or ["Software Engineering"],
            project_signals=project_signals or ["API design"],
            source_title=source_title,
            source_url="https://example.invalid/demo-job",
            published_on=date(2026, 7, 21),
            valid_until=valid_until,
            status=status,
            demo_only=demo_only,
        )
