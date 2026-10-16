"""Deterministic strategy report generated from simulation results."""

DISCLAIMER = "结果基于合成群体与规则模型，不代表真实就业预测。"

METRIC_LABELS = {
    "readiness_rate": "就业准备达标率",
    "matched_rate": "岗位匹配达成率",
    "high_risk_count": "高风险人数",
    "avg_gap": "平均技能缺口",
    "counselor_utilization": "教师工时占用率",
}

SCENARIO_LABELS = {
    "baseline": "现状基线",
    "skill_training": "技能补强培训",
    "precision_coaching": "精准帮扶",
    "job_push": "岗位精准推送",
    "combined": "组合策略",
}


def build_report(results: dict[str, object]) -> dict[str, object]:
    """Build a deterministic strategy report from simulation results."""
    scenarios = results.get("scenarios", {})
    baseline = scenarios.get("baseline", {})
    baseline_summary = baseline.get("summary", {})

    findings: list[str] = []
    ranking: list[dict[str, object]] = []
    for scenario, payload in scenarios.items():
        label = SCENARIO_LABELS.get(scenario, scenario)
        summary = payload.get("summary", {})
        matched = summary.get("matched_rate", {}).get("mean", 0.0)
        ranking.append({"scenario": scenario, "label": label, "matched_rate": matched})

    ranking.sort(key=lambda item: float(item["matched_rate"]), reverse=True)
    best = ranking[0] if ranking else None

    if best and baseline_summary:
        base_matched = baseline_summary.get("matched_rate", {}).get("mean", 0.0)
        lift = float(best["matched_rate"]) - float(base_matched)
        if best["scenario"] != "baseline":
            findings.append(
                f"{best['label']}使终点匹配达成率较基线提升 {lift * 100:.1f} 个百分点。"
            )

    for scenario, payload in scenarios.items():
        label = SCENARIO_LABELS.get(scenario, scenario)
        summary = payload.get("summary", {})
        matched = summary.get("matched_rate", {})
        readiness = summary.get("readiness_rate", {})
        if matched:
            ci_text = (
                f"{float(matched['ci_low']) * 100:.1f}%–{float(matched['ci_high']) * 100:.1f}%"
            )
            findings.append(
                f"{label}终点匹配达成率 {float(matched['mean']) * 100:.1f}%（95% CI {ci_text}）。"
            )
        if readiness:
            findings.append(
                f"{label}终点就业准备达标率 {float(readiness['mean']) * 100:.1f}%。"
            )

    recommendation = "建议优先采用" + (f"「{best['label']}」策略。" if best else "基线策略。")

    return {
        "ranking": ranking,
        "findings": findings,
        "recommendation": recommendation,
        "caveats": [DISCLAIMER],
    }
