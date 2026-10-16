"""Tests for governance API contracts, payload validation, and report generation."""

import unittest
from uuid import uuid4

from app.api.governance import (
    RiskItem,
    SimulationCreatePayload,
    SimulationDefaultsResponse,
    _ai_narrative_from_response,
)
from app.services.insights import build_insights
from app.services.simulation.report import DISCLAIMER, build_report
from pydantic import ValidationError


class SimulationPayloadValidationTests(unittest.TestCase):
    def test_rejects_unknown_fields(self) -> None:
        with self.assertRaises(ValidationError):
            SimulationCreatePayload(cohort_size=100, unknown_field="x")

    def test_rejects_cohort_size_above_max(self) -> None:
        with self.assertRaises(ValidationError):
            SimulationCreatePayload(cohort_size=1001)

    def test_rejects_cohort_size_below_min(self) -> None:
        with self.assertRaises(ValidationError):
            SimulationCreatePayload(cohort_size=49)

    def test_rejects_missing_baseline(self) -> None:
        with self.assertRaises(ValidationError):
            SimulationCreatePayload(scenarios=["skill_training"])

    def test_rejects_unknown_scenario(self) -> None:
        with self.assertRaises(ValidationError):
            SimulationCreatePayload(scenarios=["baseline", "not_a_scenario"])

    def test_accepts_valid_payload(self) -> None:
        payload = SimulationCreatePayload(
            cohort_size=100, weeks=8, replications=2, scenarios=["baseline", "job_push"]
        )
        self.assertEqual(payload.cohort_size, 100)
        self.assertEqual(payload.scenarios, ["baseline", "job_push"])


class RiskItemSchemaTests(unittest.TestCase):
    def test_risk_item_has_no_contact_fields(self) -> None:
        fields = set(RiskItem.model_fields.keys())
        self.assertNotIn("phone", fields)
        self.assertNotIn("email", fields)
        self.assertNotIn("student_number", fields)
        self.assertIn("student_id", fields)
        self.assertIn("display_name", fields)
        self.assertIn("score", fields)
        self.assertIn("level", fields)

    def test_risk_item_constructs(self) -> None:
        item = RiskItem(
            student_id=uuid4(),
            display_name="学生",
            major="软件工程",
            job_stage="preparing",
            score=45,
            level="medium",
            factors={"profile": 10, "match": 25, "gap": 10},
            reasons=["岗位匹配分偏低"],
            actions=["组织岗位方向咨询"],
        )
        self.assertEqual(item.level, "medium")


class InsightsTests(unittest.TestCase):
    def test_synthetic_insights_are_marked(self) -> None:
        payload = build_insights(None, source="synthetic", seed=1, cohort_size=50)
        self.assertTrue(payload["synthetic"])
        self.assertEqual(payload["source"], "synthetic")

    def test_insights_never_return_individual_records(self) -> None:
        payload = build_insights(None, source="synthetic", seed=1, cohort_size=50)
        for group in payload["groups"]:
            self.assertGreaterEqual(group["count"], 5)


class ReportTests(unittest.TestCase):
    def _results(self) -> dict:
        return {
            "scenarios": {
                "baseline": {
                    "summary": {
                        "matched_rate": {"mean": 0.40, "ci_low": 0.38, "ci_high": 0.42},
                        "readiness_rate": {"mean": 0.55, "ci_low": 0.53, "ci_high": 0.57},
                    }
                },
                "precision_coaching": {
                    "summary": {
                        "matched_rate": {"mean": 0.50, "ci_low": 0.48, "ci_high": 0.52},
                        "readiness_rate": {"mean": 0.62, "ci_low": 0.60, "ci_high": 0.64},
                    }
                },
            }
        }

    def test_report_contains_disclaimer(self) -> None:
        report = build_report(self._results())
        self.assertIn(DISCLAIMER, report["caveats"])

    def test_report_ranks_precision_above_baseline(self) -> None:
        report = build_report(self._results())
        self.assertEqual(report["ranking"][0]["scenario"], "precision_coaching")

    def test_report_recommends_best_scenario(self) -> None:
        report = build_report(self._results())
        self.assertIn("精准帮扶", report["recommendation"])

    def test_report_values_match_results(self) -> None:
        report = build_report(self._results())
        findings_text = " ".join(report["findings"])
        self.assertIn("50.0%", findings_text)
        self.assertIn("40.0%", findings_text)


class DefaultsResponseTests(unittest.TestCase):
    def test_defaults_present_bounds(self) -> None:
        defaults = SimulationDefaultsResponse(
            cohort_size={"default": 300, "min": 50, "max": 1000},
            weeks={"default": 16, "min": 4, "max": 26},
            replications={"default": 10, "min": 1, "max": 20},
            scenarios=["baseline", "skill_training", "precision_coaching", "job_push", "combined"],
        )
        self.assertEqual(defaults.cohort_size["default"], 300)
        self.assertIn("baseline", defaults.scenarios)


class AiNarrativeTests(unittest.TestCase):
    def test_handoff_response_yields_no_ai_narrative(self) -> None:
        from app.clients.fastgpt import handoff_response

        response = handoff_response(mode="mock")
        narrative, requires_review = _ai_narrative_from_response(response)
        self.assertIsNone(narrative)
        self.assertFalse(requires_review)

    def test_answered_response_yields_ai_narrative_and_review_flag(self) -> None:
        from app.clients.fastgpt import AssistantResponse

        response = AssistantResponse(
            answer="精准帮扶策略效果更优。",
            sources=(),
            disclaimer="仅供参考",
            handoff_recommended=False,
            mode="mock",
        )
        narrative, requires_review = _ai_narrative_from_response(response)
        self.assertEqual(narrative, "精准帮扶策略效果更优。")
        self.assertTrue(requires_review)


if __name__ == "__main__":
    unittest.main()
