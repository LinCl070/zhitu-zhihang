"""Tests for the deterministic employment-readiness risk model."""

import dataclasses
import unittest

from app.models.entities import JobStage
from app.services.risk import RiskAssessment, RiskInput, assess_risk


def _input(**overrides) -> RiskInput:
    base = dict(
        has_profile=True,
        skill_count=5,
        project_count=2,
        job_stage=JobStage.PREPARING,
        best_match_score=80,
        best_match_gap_count=0,
        best_match_gaps=(),
        has_plan=True,
        days_since_update=5,
        months_to_graduation=10,
    )
    base.update(overrides)
    return RiskInput(**base)


class RiskModelTests(unittest.TestCase):
    def test_risk_input_contains_no_sensitive_fields(self) -> None:
        fields = {field.name for field in dataclasses.fields(RiskInput)}
        sensitive = {"phone", "email", "student_number", "gender", "hometown", "health_status"}
        self.assertFalse(fields & sensitive)
        self.assertIn("has_profile", fields)
        self.assertIn("best_match_score", fields)

    def test_complete_profile_yields_low_risk(self) -> None:
        assessment = assess_risk(_input())
        self.assertEqual(assessment.score, 0)
        self.assertEqual(assessment.level, "low")
        self.assertEqual(assessment.reasons, [])
        self.assertEqual(assessment.actions, [])

    def test_no_profile_contributes_full_profile_weight(self) -> None:
        assessment = assess_risk(
            _input(has_profile=False, skill_count=0, project_count=0, job_stage=None)
        )
        self.assertEqual(assessment.factors["profile"], 25)

    def test_sparse_profile_contributes_partial_profile_weight(self) -> None:
        assessment = assess_risk(_input(skill_count=2, project_count=0))
        self.assertEqual(assessment.factors["profile"], 10)

    def test_match_factor_boundaries(self) -> None:
        high = assess_risk(_input(best_match_score=70, best_match_gap_count=0))
        self.assertEqual(high.factors["match"], 0)
        mid = assess_risk(_input(best_match_score=55))
        self.assertEqual(mid.factors["match"], 12)
        low = assess_risk(_input(best_match_score=40))
        self.assertEqual(low.factors["match"], 25)
        none = assess_risk(_input(best_match_score=None))
        self.assertEqual(none.factors["match"], 25)

    def test_gap_factor_scales_and_caps(self) -> None:
        self.assertEqual(assess_risk(_input(best_match_gap_count=1)).factors["gap"], 5)
        self.assertEqual(assess_risk(_input(best_match_gap_count=2)).factors["gap"], 10)
        self.assertEqual(assess_risk(_input(best_match_gap_count=3)).factors["gap"], 15)
        self.assertEqual(assess_risk(_input(best_match_gap_count=10)).factors["gap"], 15)

    def test_stage_factor_rules(self) -> None:
        exploring_near = assess_risk(
            _input(job_stage=JobStage.EXPLORING, months_to_graduation=12)
        )
        self.assertEqual(exploring_near.factors["stage"], 20)
        exploring_unknown = assess_risk(
            _input(job_stage=JobStage.EXPLORING, months_to_graduation=None)
        )
        self.assertEqual(exploring_unknown.factors["stage"], 10)
        exploring_far = assess_risk(
            _input(job_stage=JobStage.EXPLORING, months_to_graduation=18)
        )
        self.assertEqual(exploring_far.factors["stage"], 0)
        preparing_near = assess_risk(
            _input(job_stage=JobStage.PREPARING, months_to_graduation=6)
        )
        self.assertEqual(preparing_near.factors["stage"], 12)
        applying = assess_risk(_input(job_stage=JobStage.APPLYING, months_to_graduation=3))
        self.assertEqual(applying.factors["stage"], 0)

    def test_plan_and_stale_factors(self) -> None:
        no_plan = assess_risk(_input(has_plan=False))
        self.assertEqual(no_plan.factors["plan"], 10)
        stale = assess_risk(_input(days_since_update=31))
        self.assertEqual(stale.factors["stale"], 5)
        fresh = assess_risk(_input(days_since_update=30))
        self.assertEqual(fresh.factors["stale"], 0)

    def test_level_thresholds(self) -> None:
        # 25 (no profile) + 25 (no match) + 10 (plan) = 60 -> high
        high = assess_risk(
            _input(
                has_profile=False,
                skill_count=0,
                project_count=0,
                job_stage=None,
                best_match_score=None,
                has_plan=False,
            )
        )
        self.assertEqual(high.score, 60)
        self.assertEqual(high.level, "high")
        # 35 boundary -> medium
        medium = assess_risk(
            _input(best_match_score=40, has_plan=False, best_match_gap_count=0)
        )
        self.assertEqual(medium.score, 35)
        self.assertEqual(medium.level, "medium")
        low = assess_risk(_input(best_match_score=55))
        self.assertEqual(low.level, "low")

    def test_actions_map_to_nonzero_factors(self) -> None:
        assessment = assess_risk(
            _input(
                best_match_score=40,
                best_match_gap_count=2,
                best_match_gaps=("Docker", "Redis"),
                has_plan=False,
                days_since_update=40,
            )
        )
        self.assertTrue(any("岗位方向咨询" in action for action in assessment.actions))
        self.assertTrue(any("Docker" in action for action in assessment.actions))
        self.assertTrue(any("行动计划" in action for action in assessment.actions))
        self.assertTrue(any("跟进近况" in action for action in assessment.actions))

    def test_assessment_is_a_risk_assessment(self) -> None:
        assessment = assess_risk(_input())
        self.assertIsInstance(assessment, RiskAssessment)
        self.assertEqual(assessment.score, sum(assessment.factors.values()))


if __name__ == "__main__":
    unittest.main()
