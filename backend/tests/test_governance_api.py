"""Tests for governance API contracts, payload validation, and report generation."""

import unittest
from uuid import uuid4

from app.api.governance import (
    RiskItem,
    SimulationCreatePayload,
    SimulationDefaultsResponse,
    _ai_narrative_from_response,
    _synthetic_csv_content,
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

    def test_report_no_recommendation_when_ci_overlaps(self) -> None:
        # Overlapping CIs mean the difference is not significant: the report must
        # not emit "建议优先采用" nor claim a lift.
        results = {
            "scenarios": {
                "baseline": {
                    "summary": {
                        "matched_rate": {"mean": 0.50, "ci_low": 0.45, "ci_high": 0.55},
                        "readiness_rate": {"mean": 0.60, "ci_low": 0.55, "ci_high": 0.65},
                    }
                },
                "precision_coaching": {
                    "summary": {
                        "matched_rate": {"mean": 0.52, "ci_low": 0.48, "ci_high": 0.56},
                        "readiness_rate": {"mean": 0.62, "ci_low": 0.57, "ci_high": 0.67},
                    }
                },
            }
        }
        report = build_report(results)
        self.assertNotIn("建议优先采用", report["recommendation"])
        findings_text = " ".join(report["findings"])
        self.assertIn("差异不显著", findings_text)
        self.assertNotIn("提升", findings_text)

    def test_report_recommends_when_ci_disjoint(self) -> None:
        results = {
            "scenarios": {
                "baseline": {
                    "summary": {
                        "matched_rate": {"mean": 0.40, "ci_low": 0.38, "ci_high": 0.42},
                        "readiness_rate": {"mean": 0.55, "ci_low": 0.53, "ci_high": 0.57},
                    }
                },
                "precision_coaching": {
                    "summary": {
                        "matched_rate": {"mean": 0.60, "ci_low": 0.58, "ci_high": 0.62},
                        "readiness_rate": {"mean": 0.70, "ci_low": 0.68, "ci_high": 0.72},
                    }
                },
            }
        }
        report = build_report(results)
        self.assertIn("建议优先采用", report["recommendation"])
        findings_text = " ".join(report["findings"])
        self.assertIn("提升", findings_text)


class SyntheticCsvExportTests(unittest.TestCase):
    def _agent(self, **overrides):
        from app.models.entities import JobStage
        from app.services.simulation.cohort import StudentAgent

        base = dict(
            id="syn-0",
            major="软件工程",
            skills=["Java", "SQL"],
            projects=["后端项目"],
            target_role="后端开发实习生",
            target_city="成都",
            city_flex=0.0,
            learning_rate=0.3,
            initiative=0.5,
            stage=JobStage.PREPARING,
            months_to_graduation=10.0,
        )
        base.update(overrides)
        return StudentAgent(**base)

    def test_csv_metadata_header_and_roundtrip(self) -> None:
        import csv
        import io

        agents = [self._agent(), self._agent(id="syn-1", skills=["Java", "SQL"])]
        content = _synthetic_csv_content(
            agents, seed=42, cohort_size=2, model_version="abm-1.0"
        )
        rows = list(csv.reader(io.StringIO(content)))
        # First row carries generation metadata; second row is the column header.
        self.assertEqual(rows[0][0], "# seed")
        self.assertEqual(rows[0][1], "42")
        self.assertIn("cohort_size", rows[0])
        self.assertIn("model_version", rows[0])
        self.assertEqual(
            rows[1],
            ["id", "major", "skills", "projects", "target_role", "target_city", "stage"],
        )
        # Two data rows, each with 7 columns.
        self.assertEqual(len(rows), 4)
        self.assertEqual(rows[2][0], "syn-0")
        self.assertEqual(rows[3][0], "syn-1")

    def test_csv_quotes_fields_with_commas(self) -> None:
        import csv
        import io

        # A field containing a comma must be quoted so round-tripping is lossless.
        agents = [self._agent(major="数据,科学", skills=["Java", "机器学习,深度学习"])]
        content = _synthetic_csv_content(
            agents, seed=1, cohort_size=1, model_version="abm-1.0"
        )
        rows = list(csv.reader(io.StringIO(content)))
        data = rows[2]
        self.assertEqual(data[1], "数据,科学")
        self.assertEqual(data[2], "Java|机器学习,深度学习")
        # The raw text must quote the comma-containing field.
        self.assertIn('"', content)

    def test_csv_quotes_fields_with_double_quotes(self) -> None:
        import csv
        import io

        agents = [self._agent(projects=['项目"甲'])]
        content = _synthetic_csv_content(
            agents, seed=1, cohort_size=1, model_version="abm-1.0"
        )
        rows = list(csv.reader(io.StringIO(content)))
        self.assertEqual(rows[2][3], '项目"甲')


class DefaultsResponseTests(unittest.TestCase):
    def test_defaults_present_bounds(self) -> None:
        defaults = SimulationDefaultsResponse(
            cohort_size={"default": 300, "min": 50, "max": 1000},
            weeks={"default": 16, "min": 4, "max": 26},
            replications={"default": 10, "min": 1, "max": 20},
            seed={"default": 1, "min": 1, "max": 1_000_000},
            counselor_count={"default": 4, "min": 0, "max": 100},
            sessions_per_week={"default": 8, "min": 1, "max": 40},
            supply_ratio={"default": 0.8, "min": 0.0, "max": 2.0},
            scenarios=["baseline", "skill_training", "precision_coaching", "job_push", "combined"],
        )
        self.assertEqual(defaults.cohort_size["default"], 300)
        self.assertEqual(defaults.supply_ratio["default"], 0.8)
        self.assertEqual(defaults.counselor_count["default"], 4)
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
