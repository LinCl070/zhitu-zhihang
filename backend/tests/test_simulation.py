"""Tests for synthetic cohort generation and fast scoring equivalence."""

import time
import unittest
from datetime import date
from random import Random
from uuid import uuid4

from app.models.entities import CareerProfile, JobPosting, JobStage, JobStatus
from app.services.matching import MatchingService
from app.services.simulation.cohort import JobTemplate, generate_cohort, load_job_templates
from app.services.simulation.engine import MODEL_VERSION, SimulationEngine, SimulationParams
from app.services.simulation.scoring import FastScorer


class CohortGenerationTests(unittest.TestCase):
    def test_same_seed_yields_identical_cohort(self) -> None:
        first = generate_cohort(100, seed=42)
        second = generate_cohort(100, seed=42)
        self.assertEqual([agent.id for agent in first], [agent.id for agent in second])
        self.assertEqual([agent.major for agent in first], [agent.major for agent in second])
        self.assertEqual([agent.skills for agent in first], [agent.skills for agent in second])
        self.assertEqual([agent.stage for agent in first], [agent.stage for agent in second])

    def test_different_seed_yields_different_cohort(self) -> None:
        first = generate_cohort(100, seed=1)
        second = generate_cohort(100, seed=2)
        self.assertNotEqual([agent.skills for agent in first], [agent.skills for agent in second])

    def test_agent_ids_are_synthetic(self) -> None:
        agents = generate_cohort(10, seed=7)
        self.assertEqual([agent.id for agent in agents], [f"syn-{i}" for i in range(10)])

    def test_attributes_stay_within_bounds(self) -> None:
        agents = generate_cohort(200, seed=11)
        for agent in agents:
            self.assertGreaterEqual(agent.learning_rate, 0.15)
            self.assertLessEqual(agent.learning_rate, 0.45)
            self.assertGreaterEqual(agent.initiative, 0.3)
            self.assertLessEqual(agent.initiative, 0.9)
            self.assertIn(agent.stage, {JobStage.EXPLORING, JobStage.PREPARING, JobStage.APPLYING})
            self.assertGreaterEqual(len(agent.skills), 2)
            self.assertLessEqual(len(agent.skills), 5)


class FastScorerEquivalenceTests(unittest.TestCase):
    def test_fast_scorer_matches_matching_service_on_500_samples(self) -> None:
        rng = Random(20261016)
        templates = load_job_templates(50)
        if not templates:
            self.skipTest("No job templates available")
        scorer = FastScorer(templates)

        skill_pool = sorted({skill for template in templates for skill in template.required_skills})
        majors = sorted({major for template in templates for major in template.preferred_majors})
        projects_pool = sorted(
            {signal for template in templates for signal in template.project_signals}
        )

        for _ in range(500):
            agent = _random_agent(rng, skill_pool, majors, projects_pool)
            profile, jobs = _to_matching_inputs(agent, templates, rng)

            matching_service = MatchingService()
            matches = matching_service.match(profile, jobs, as_of=date(2026, 12, 31))
            matching_best = matches[0].score if matches else 0

            fast_best = scorer.best_score(agent, all_cities=True).score

            self.assertEqual(fast_best, matching_best)


class EngineDeterminismTests(unittest.TestCase):
    def _small_params(self, **overrides) -> SimulationParams:
        base = dict(
            cohort_size=50,
            weeks=4,
            replications=3,
            seed=7,
            scenarios=("baseline", "precision_coaching"),
        )
        base.update(overrides)
        return SimulationParams(**base)

    def test_same_params_yield_identical_results(self) -> None:
        first = SimulationEngine().run(self._small_params())
        second = SimulationEngine().run(self._small_params())
        self.assertEqual(first, second)

    def test_model_version_is_present(self) -> None:
        result = SimulationEngine().run(self._small_params())
        self.assertEqual(result["model_version"], MODEL_VERSION)

    def test_common_random_numbers_scenario_independence(self) -> None:
        # Baseline must be identical whether or not other scenarios are also run.
        alone = SimulationEngine().run(self._small_params(scenarios=("baseline",)))
        together = SimulationEngine().run(
            self._small_params(scenarios=("baseline", "precision_coaching"))
        )
        self.assertEqual(alone["scenarios"]["baseline"], together["scenarios"]["baseline"])

    def test_summary_contains_mean_and_ci(self) -> None:
        result = SimulationEngine().run(self._small_params())
        for scenario in result["scenarios"].values():
            for _metric, stats in scenario["summary"].items():
                self.assertIn("mean", stats)
                self.assertIn("ci_low", stats)
                self.assertIn("ci_high", stats)
                self.assertLessEqual(stats["ci_low"], stats["mean"])
                self.assertLessEqual(stats["mean"], stats["ci_high"])

    def test_supply_ratio_zero_yields_no_matches(self) -> None:
        result = SimulationEngine().run(self._small_params(supply_ratio=0.0))
        baseline = result["scenarios"]["baseline"]
        final_week = baseline["weeks"][-1]
        self.assertEqual(final_week["matched_rate"], 0.0)

    def test_counselor_count_zero_makes_precision_equal_baseline(self) -> None:
        result = SimulationEngine().run(
            self._small_params(
                counselor_count=0,
                scenarios=("baseline", "precision_coaching"),
            )
        )
        baseline = result["scenarios"]["baseline"]
        precision = result["scenarios"]["precision_coaching"]
        # The scenario label differs by design; all metrics must be identical.
        self.assertEqual(baseline["weeks"], precision["weeks"])
        self.assertEqual(baseline["summary"], precision["summary"])
        self.assertEqual(baseline["top_skill_gaps"], precision["top_skill_gaps"])
        self.assertEqual(baseline["weeks"][-1]["counselor_utilization"], 0.0)

    def test_default_params_complete_within_10_seconds(self) -> None:
        params = SimulationParams(
            cohort_size=300,
            weeks=16,
            replications=10,
            scenarios=("baseline", "skill_training", "precision_coaching", "job_push"),
        )
        start = time.perf_counter()
        SimulationEngine().run(params)
        elapsed = time.perf_counter() - start
        self.assertLess(elapsed, 10.0)


def _random_agent(
    rng: Random, skill_pool: list[str], majors: list[str], projects_pool: list[str]
):
    from app.services.simulation.cohort import StudentAgent

    skills = rng.sample(skill_pool, k=min(len(skill_pool), rng.randint(1, 5)))
    projects = rng.sample(projects_pool, k=min(len(projects_pool), rng.randint(0, 2)))
    major = rng.choice(majors) if majors else "未分类"
    target_role = rng.choice([t for t in _TITLES]) if _TITLES else "通用岗位"
    return StudentAgent(
        id="syn-test",
        major=major,
        skills=skills,
        projects=projects,
        target_role=target_role,
        target_city="成都",
        city_flex=0.0,
        learning_rate=0.3,
        initiative=0.5,
        stage=JobStage.PREPARING,
        months_to_graduation=10.0,
    )


_TITLES = ["后端开发实习生", "数据分析实习生", "Java开发工程师", "嵌入式物联网开发工程师"]


def _to_matching_inputs(agent, templates: list[JobTemplate], rng: Random):
    profile = CareerProfile(
        id=uuid4(),
        student_id=uuid4(),
        major=agent.major,
        skills=agent.skills,
        projects=agent.projects,
        target_roles=[agent.target_role],
        target_cities=[agent.target_city],
        job_stage=agent.stage,
    )
    jobs = []
    for template in templates:
        jobs.append(
            JobPosting(
                id=uuid4(),
                title=template.title,
                company_name="合成测试",
                city=template.city,
                employment_type="全职",
                required_skills=list(template.required_skills),
                preferred_majors=list(template.preferred_majors),
                project_signals=list(template.project_signals),
                source_title="合成测试来源",
                source_url=None,
                published_on=date(2026, 1, 1),
                valid_until=date(2027, 12, 31),
                status=JobStatus.PUBLISHED,
                demo_only=True,
            )
        )
    return profile, jobs


if __name__ == "__main__":
    unittest.main()
