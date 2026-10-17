"""One-at-a-time sensitivity analysis for the ABM simulation.

Writes ``docs/deliverables/simulation-sensitivity.md`` for the proposal and a JSON
copy (``simulation-sensitivity.json``) consumed by the proposal docx builder.
All conclusions are derived from the generated data, including a CI-overlap
significance check, so no claim is hardcoded.
"""

import json
import time
from pathlib import Path

from app.services.simulation.engine import MODEL_VERSION, SimulationEngine, SimulationParams

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "docs" / "deliverables"
MD_PATH = OUTPUT_DIR / "simulation-sensitivity.md"
JSON_PATH = OUTPUT_DIR / "simulation-sensitivity.json"

# Seed 1 matches the UI default so the proposal numbers are reproducible from the app.
BASE = dict(
    cohort_size=300,
    weeks=16,
    replications=10,
    counselor_count=4,
    sessions_per_week=8,
    supply_ratio=0.8,
    seed=1,
    scenarios=("baseline", "precision_coaching"),
)
FOUR_SCENARIOS = ("baseline", "skill_training", "precision_coaching", "job_push")

SWEEPS = [
    ("supply_ratio", "岗位供给比例", [0.2, 0.5, 0.8, 1.2]),
    ("counselor_count", "教师数量", [0, 2, 4, 8]),
    ("learning_rate", "学习率", [0.15, 0.3, 0.45]),
]

LABELS = {
    "baseline": "现状基线",
    "skill_training": "技能补强培训",
    "precision_coaching": "精准帮扶",
    "job_push": "岗位精准推送",
    "combined": "组合策略",
}


def _significant(a: dict[str, float], b: dict[str, float]) -> bool:
    """Two 95% CIs that do not overlap are treated as a significant difference."""
    return a["ci_high"] < b["ci_low"] or b["ci_high"] < a["ci_low"]


def _pct(ci: dict[str, float]) -> dict[str, float]:
    return {key: round(value * 100, 1) for key, value in ci.items()}


def _one(ci: dict[str, float]) -> dict[str, float]:
    return {key: round(value, 1) for key, value in ci.items()}


def _sweep_point(parameter: str | None, value: float | None) -> dict[str, object]:
    overrides = dict(BASE)
    if parameter is not None:
        overrides[parameter] = value
    result = SimulationEngine().run(SimulationParams(**overrides))
    base = result["scenarios"]["baseline"]["summary"]
    precision = result["scenarios"]["precision_coaching"]["summary"]
    return {
        "parameter": parameter,
        "value": value,
        "baseline_matched": _pct(base["matched_rate"]),
        "precision_matched": _pct(precision["matched_rate"]),
        "lift_pp": round(
            (precision["matched_rate"]["mean"] - base["matched_rate"]["mean"]) * 100, 1
        ),
        "lift_significant": _significant(base["matched_rate"], precision["matched_rate"]),
        "baseline_high_risk": _one(base["high_risk_count"]),
        "precision_high_risk": _one(precision["high_risk_count"]),
        "high_risk_significant": _significant(
            base["high_risk_count"], precision["high_risk_count"]
        ),
    }


def _four_scenarios() -> tuple[dict[str, object], float]:
    start = time.perf_counter()
    result = SimulationEngine().run(
        SimulationParams(
            cohort_size=300, weeks=16, replications=10, seed=1, scenarios=FOUR_SCENARIOS
        )
    )
    elapsed = time.perf_counter() - start
    baseline = result["scenarios"]["baseline"]["summary"]
    rows: dict[str, object] = {}
    for key, payload in result["scenarios"].items():
        summary = payload["summary"]
        rows[key] = {
            "label": LABELS[key],
            "matched": _pct(summary["matched_rate"]),
            "readiness": _pct(summary["readiness_rate"]),
            "high_risk": _one(summary["high_risk_count"]),
            "avg_gap": _one(summary["avg_gap"]),
            "matched_lift_pp": round(
                (summary["matched_rate"]["mean"] - baseline["matched_rate"]["mean"]) * 100, 1
            ),
            "matched_significant": key != "baseline"
            and _significant(baseline["matched_rate"], summary["matched_rate"]),
            "high_risk_significant": key != "baseline"
            and _significant(baseline["high_risk_count"], summary["high_risk_count"]),
            "top_skill_gaps": [
                {
                    "skill": g["skill"],
                    "demand": g["demand"],
                    "supply": g["supply"],
                    "gap": round(float(g["gap"]), 1),
                }
                for g in payload["top_skill_gaps"][:5]
            ],
            "weekly": payload["weeks"],
        }
    return rows, round(elapsed, 1)


def _trend(values: list[float], tol: float) -> str:
    diffs = [b - a for a, b in zip(values, values[1:], strict=False)]
    if all(d > tol for d in diffs):
        return "单调上升"
    if all(d < -tol for d in diffs):
        return "单调下降"
    return "无一致趋势"


def _conclusions(sweeps: dict[str, list[dict[str, object]]]) -> list[str]:
    lines: list[str] = []
    for parameter, label, values in SWEEPS:
        points = sweeps[parameter]
        base_means = [p["baseline_matched"]["mean"] for p in points]
        main = (
            f"{label}从 {values[0]} 变化到 {values[-1]} 时，基线终点匹配达成率由 "
            f"{base_means[0]:.1f}% 变为 {base_means[-1]:.1f}%（{_trend(base_means, 0.5)}）。"
        )
        sig = [p for p in points if p["lift_significant"]]
        lifts = " / ".join(f"{p['lift_pp']:+.1f}" for p in points)
        if not sig:
            lift_text = (
                f"精准帮扶相对基线的匹配达成率差值为 {lifts} 个百分点，"
                "各取值下置信区间均重叠，差异不显著，不据此判断趋势。"
            )
        else:
            names = "、".join(str(p["value"]) for p in sig)
            lift_text = (
                f"精准帮扶相对基线的匹配达成率差值为 {lifts} 个百分点，"
                f"仅在取值 {names} 时置信区间不重叠。"
            )
        hr_sig = [p for p in points if p["high_risk_significant"]]
        hr_text = f"高风险人数方面，精准帮扶在 {len(hr_sig)}/{len(points)} 个取值下显著低于基线。"
        lines.append(f"- {main}{lift_text}{hr_text}")
    return lines


def main() -> None:
    start = time.perf_counter()
    base_point = _sweep_point(None, None)
    sweeps = {
        parameter: [_sweep_point(parameter, value) for value in values]
        for parameter, _, values in SWEEPS
    }
    four, four_elapsed = _four_scenarios()
    total_elapsed = round(time.perf_counter() - start, 1)
    conclusions = _conclusions(sweeps)

    data = {
        "model_version": MODEL_VERSION,
        "seed": 1,
        "base_params": {k: v for k, v in BASE.items() if k != "scenarios"},
        "base_point": base_point,
        "sweeps": sweeps,
        "four_scenarios": four,
        "four_scenarios_elapsed_s": four_elapsed,
        "total_elapsed_s": total_elapsed,
        "conclusions": conclusions,
    }
    JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def ci(c: dict[str, float], unit: str = "") -> str:
        return f"{c['mean']:.1f}{unit}（{c['ci_low']:.1f}–{c['ci_high']:.1f}）"

    md = [
        "# 仿真模型敏感性分析",
        "",
        "> 本文件由 `backend/scripts/simulation_sensitivity.py` 自动生成，"
        "数字与结论均来自脚本实际输出。",
        f"> 模型版本 {MODEL_VERSION}，种子 1（与 UI 默认一致），300 人 × 16 周 × 10 次重复；"
        "显著性按两组 95% 置信区间是否重叠判断。",
        f"> 全部扫描耗时 {total_elapsed} 秒；默认 4 场景单次运行耗时 {four_elapsed} 秒。",
        "",
        "## 默认参数四场景对照",
        "",
        "| 场景 | 终点匹配达成率 %（95% CI） | 较基线 | 就业准备达标率 % | 高风险人数（95% CI） |",
        "|:---|:---|:---|:---|:---|",
    ]
    for key, row in four.items():
        lift = (
            "—"
            if key == "baseline"
            else (
                f"{row['matched_lift_pp']:+.1f}"
                + ("（显著）" if row["matched_significant"] else "（不显著）")
            )
        )
        hr = ci(row["high_risk"]) + (
            "（显著）"
            if row["high_risk_significant"]
            else ("" if key == "baseline" else "（不显著）")
        )
        md.append(
            f"| {row['label']} | {ci(row['matched'])} | {lift} "
            f"| {row['readiness']['mean']:.1f} | {hr} |"
        )
    md += [
        "",
        "## OAT 敏感性扫描（基线 vs 精准帮扶）",
        "",
        "| 参数 | 取值 | 基线匹配 % | 精准帮扶匹配 % | 差值（百分点） "
        "| 基线高风险 | 精准帮扶高风险 |",
        "|:---|:---|:---|:---|:---|:---|:---|",
    ]
    for parameter, label, _ in SWEEPS:
        for p in sweeps[parameter]:
            md.append(
                f"| {label} | {p['value']} | {ci(p['baseline_matched'])} "
                f"| {ci(p['precision_matched'])} | {p['lift_pp']:+.1f}"
                f"{'' if p['lift_significant'] else '（不显著）'} "
                f"| {ci(p['baseline_high_risk'])} | {ci(p['precision_high_risk'])} |"
            )
    md += ["", "## 结论（脚本自动推导）", "", *conclusions, ""]
    MD_PATH.write_text("\n".join(md), encoding="utf-8")
    print(
        f"wrote {MD_PATH}\nwrote {JSON_PATH}\ntotal {total_elapsed}s, four-scenario {four_elapsed}s"
    )


if __name__ == "__main__":
    main()
