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

    # When the best (non-baseline) scenario's 95% CI overlaps the baseline's, the
    # difference is not significant and we must not recommend adopting it.
    best_matched = baseline_summary.get("matched_rate", {})
    base_matched = best_matched.get("mean", 0.0)
    significant = False
    if best and best["scenario"] != "baseline":
        best_ci = scenarios.get(best["scenario"], {}).get("summary", {}).get("matched_rate", {})
        base_ci = best_matched
        best_low = float(best_ci.get("ci_low", base_matched))
        best_high = float(best_ci.get("ci_high", base_matched))
        base_low = float(base_ci.get("ci_low", base_matched))
        base_high = float(base_ci.get("ci_high", base_matched))
        overlap = best_low <= base_high and base_low <= best_high
        significant = not overlap
        lift = float(best["matched_rate"]) - float(base_matched)
        if significant:
            findings.append(
                f"{best['label']}使终点匹配达成率较基线提升 {lift * 100:.1f} 个百分点。"
            )
        else:
            findings.append(
                f"{best['label']}与基线的终点匹配达成率差异不显著（95% 置信区间重叠）。"
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

    if best and best["scenario"] != "baseline" and significant:
        recommendation = f"建议优先采用「{best['label']}」策略。"
    else:
        recommendation = "各策略与基线差异不显著，建议结合其他证据审慎决策。"

    return {
        "ranking": ranking,
        "findings": findings,
        "recommendation": recommendation,
        "caveats": [DISCLAIMER],
    }
