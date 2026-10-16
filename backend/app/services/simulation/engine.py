"""Week-by-week multi-agent simulation engine with multi-scenario, multi-replication design."""

from dataclasses import dataclass, field
from math import sqrt
from random import Random
from statistics import mean

from app.models.entities import JobStage
from app.services.risk import RiskInput, assess_risk
from app.services.simulation.cohort import (
    JobTemplate,
    StudentAgent,
    generate_cohort,
    load_job_templates,
)
from app.services.simulation.scoring import FastScorer, ScoreResult

MODEL_VERSION = "abm-1.0"

READINESS_THRESHOLD = 60

# Parameter bounds (architecture section 3.7).
COHORT_MIN, COHORT_MAX, COHORT_DEFAULT = 50, 1000, 300
WEEKS_MIN, WEEKS_MAX, WEEKS_DEFAULT = 4, 26, 16
REPLICATIONS_MIN, REPLICATIONS_MAX, REPLICATIONS_DEFAULT = 1, 20, 10

COUNSELOR_COUNT_DEFAULT = 4
SESSIONS_PER_WEEK_DEFAULT = 8
SUPPLY_RATIO_DEFAULT = 0.8
COVERAGE_DEFAULT = 0.3
TRAINING_BOOST_DEFAULT = 0.2
MONTHS_TO_GRADUATION_DEFAULT = 10.0

SCENARIOS = ("baseline", "skill_training", "precision_coaching", "job_push", "combined")
COMBINED_SCENARIOS = ("skill_training", "precision_coaching", "job_push")

# Weekly metric keys.
METRICS = (
    "readiness_rate",
    "matched_rate",
    "high_risk_count",
    "avg_gap",
    "counselor_utilization",
)


@dataclass
class SimulationParams:
    cohort_size: int = COHORT_DEFAULT
    weeks: int = WEEKS_DEFAULT
    replications: int = REPLICATIONS_DEFAULT
    counselor_count: int = COUNSELOR_COUNT_DEFAULT
    sessions_per_week: int = SESSIONS_PER_WEEK_DEFAULT
    supply_ratio: float = SUPPLY_RATIO_DEFAULT
    coverage: float = COVERAGE_DEFAULT
    training_boost: float = TRAINING_BOOST_DEFAULT
    months_to_graduation: float = MONTHS_TO_GRADUATION_DEFAULT
    seed: int = 1
    scenarios: tuple[str, ...] = ("baseline",)
    learning_rate: float | None = None


@dataclass
class WeekMetric:
    week: int
    readiness_rate: float
    matched_rate: float
    high_risk_count: int
    avg_gap: float
    counselor_utilization: float


@dataclass
class ScenarioResult:
    scenario: str
    weeks: list[WeekMetric]
    summary: dict[str, dict[str, float]]
    top_skill_gaps: list[dict[str, object]]


@dataclass
class _AgentState:
    agent: StudentAgent
    index: int
    best: ScoreResult = field(default_factory=lambda: ScoreResult(score=0, gaps=()))
    dirty: bool = True


class SimulationEngine:
    """Run deterministic multi-scenario simulations with common random numbers."""

    def run(self, params: SimulationParams) -> dict[str, object]:
        jobs = load_job_templates(params.cohort_size, params.supply_ratio)
        scenario_results: dict[str, ScenarioResult] = {}
        for scenario in params.scenarios:
            scenario_results[scenario] = self._run_scenario(params, jobs, scenario)
        return {
            "params": {
                "cohort_size": params.cohort_size,
                "weeks": params.weeks,
                "replications": params.replications,
                "counselor_count": params.counselor_count,
                "sessions_per_week": params.sessions_per_week,
                "supply_ratio": params.supply_ratio,
                "coverage": params.coverage,
                "training_boost": params.training_boost,
                "months_to_graduation": params.months_to_graduation,
                "seed": params.seed,
                "scenarios": list(params.scenarios),
            },
            "model_version": MODEL_VERSION,
            "scenarios": {key: _scenario_to_dict(value) for key, value in scenario_results.items()},
        }

    def _run_scenario(
        self, params: SimulationParams, jobs: list[JobTemplate], scenario: str
    ) -> ScenarioResult:
        weekly_runs: list[list[WeekMetric]] = []
        supplies: list[dict[str, int]] = []
        for replication in range(params.replications):
            run_seed = params.seed + replication
            cohort = generate_cohort(
                params.cohort_size,
                run_seed,
                months_to_graduation_start=params.months_to_graduation,
                learning_rate=params.learning_rate,
            )
            scorer = FastScorer(jobs)
            weekly, supply = self._run_single(params, cohort, scorer, scenario, run_seed)
            weekly_runs.append(weekly)
            supplies.append(supply)

        weeks = self._aggregate_weekly(weekly_runs, params)
        summary = self._summarize(weekly_runs, params)
        top_skill_gaps = self._top_skill_gaps(supplies, jobs)
        return ScenarioResult(
            scenario=scenario, weeks=weeks, summary=summary, top_skill_gaps=top_skill_gaps
        )

    def _run_single(
        self,
        params: SimulationParams,
        cohort: list[StudentAgent],
        scorer: FastScorer,
        scenario: str,
        run_seed: int,
    ) -> tuple[list[WeekMetric], dict[str, int]]:
        states = [
            _AgentState(agent=agent, index=index) for index, agent in enumerate(cohort)
        ]
        job_capacities = {
            index: job.template.capacity for index, job in enumerate(scorer._jobs)
        }
        # ``job_push``/``combined`` unlock all cities for every agent regardless of
        # ``city_flex``; other scenarios resolve per-agent city visibility weekly.
        force_all_cities = scenario in ("job_push", "combined")
        precision = scenario in ("precision_coaching", "combined")
        training = scenario in ("skill_training", "combined")
        training_count = int(params.cohort_size * params.coverage) if training else 0

        # Initial best-match with the agent's city visibility decided for week 0.
        for state in states:
            city_open = force_all_cities or self._city_open(state, run_seed, week=0)
            state.best = scorer.best_score(state.agent, all_cities=city_open)
            state.agent.best_match_score = state.best.score
            state.agent.best_match_gaps = state.best.gaps
            state.dirty = False

        weeks: list[WeekMetric] = []
        served_this_week = 0
        for week in range(params.weeks + 1):
            weeks.append(
                self._measure(states, params, week, served_this_week)
            )
            if week == params.weeks:
                break
            served_this_week = self._advance(
                states,
                scorer,
                job_capacities,
                params,
                force_all_cities,
                precision,
                training_count,
                run_seed,
                week,
            )

        # Supply side for the skill-gap analysis: number of students who mastered
        # each skill at the terminal week (architecture 3.5).
        supply: dict[str, int] = {}
        for state in states:
            for skill in state.agent.skills:
                supply[skill] = supply.get(skill, 0) + 1

        return weeks, supply

    @staticmethod
    def _city_open(state: _AgentState, run_seed: int, week: int) -> bool:
        """Whether the agent sees all cities this week (architecture 3.3)."""
        rng = _agent_rng(run_seed, state.index, week)
        return rng.random() < state.agent.city_flex

    def _measure(
        self,
        states: list[_AgentState],
        params: SimulationParams,
        week: int,
        served_this_week: int,
    ) -> WeekMetric:
        total = len(states)
        readiness = sum(1 for s in states if s.agent.best_match_score >= READINESS_THRESHOLD)
        matched = sum(1 for s in states if s.agent.matched)
        high_risk = sum(1 for s in states if self._risk(s.agent).level == "high")
        gaps = [len(s.agent.best_match_gaps) for s in states]
        avg_gap = mean(gaps) if gaps else 0.0
        available = params.counselor_count * params.sessions_per_week
        # Actual served sessions / available sessions (architecture 3.5): already
        # matched students no longer occupy a session, so utilization can drop
        # below 1.0 as the cohort gets matched or when the cohort is small.
        utilization = served_this_week / available if available else 0.0

        return WeekMetric(
            week=week,
            readiness_rate=readiness / total if total else 0.0,
            matched_rate=matched / total if total else 0.0,
            high_risk_count=high_risk,
            avg_gap=avg_gap,
            counselor_utilization=utilization,
        )

    def _advance(
        self,
        states: list[_AgentState],
        scorer: FastScorer,
        job_capacities: dict[int, int],
        params: SimulationParams,
        force_all_cities: bool,
        precision: bool,
        training_count: int,
        run_seed: int,
        week: int,
    ) -> int:
        # Step 1: counselor service (up to available sessions). Already-matched
        # students no longer consume a session; return the actual served count.
        available = params.counselor_count * params.sessions_per_week
        order = self._service_order(states, precision, run_seed, week)
        served = 0
        for state in order:
            if served >= available:
                break
            if state.agent.matched:
                continue
            served += 1
            state.agent.initiative = min(1.0, state.agent.initiative + 0.15)
            if state.agent.stage is JobStage.EXPLORING:
                state.agent.stage = JobStage.PREPARING

        # Step 2: skill training assignment (top gap students).
        trained_ids: set[str] = set()
        if training_count > 0:
            ranked = sorted(states, key=lambda s: len(s.agent.best_match_gaps), reverse=True)
            trained_ids = {s.agent.id for s in ranked[:training_count]}

        # Step 3: student action.
        for state in states:
            agent = state.agent
            rng = _agent_rng(run_seed, state.index, week)
            if rng.random() > agent.initiative:
                continue
            if agent.stage is JobStage.EXPLORING:
                if rng.random() < 0.3:
                    agent.stage = JobStage.PREPARING
            elif agent.stage is JobStage.PREPARING:
                if self._learn(agent, params, trained_ids, rng):
                    state.dirty = True
                if agent.best_match_score >= READINESS_THRESHOLD:
                    agent.stage = JobStage.APPLYING
            elif agent.stage is JobStage.APPLYING:
                city_open = force_all_cities or self._city_open(state, run_seed, week)
                self._apply(agent, scorer, job_capacities, city_open)

        # Step 4: time advance and best-match refresh (only for changed agents).
        for state in states:
            agent = state.agent
            agent.months_to_graduation -= 0.25
            if state.dirty:
                city_open = force_all_cities or self._city_open(state, run_seed, week)
                state.best = scorer.best_score(agent, all_cities=city_open)
                state.dirty = False
            agent.best_match_score = state.best.score
            agent.best_match_gaps = state.best.gaps

        return served

    def _service_order(
        self, states: list[_AgentState], precision: bool, run_seed: int, week: int
    ) -> list[_AgentState]:
        if precision:
            return sorted(states, key=lambda s: self._risk(s.agent).score, reverse=True)
        # Derive a per-week RNG so the baseline serves a *different* random subset
        # each week (the previous code reshuffled with the same run_seed every week,
        # serving the same 32 students across all 16 weeks).
        rng = Random(f"{run_seed}:service:{week}")
        order = list(states)
        rng.shuffle(order)
        return order

    def _learn(
        self, agent: StudentAgent, params: SimulationParams, trained_ids: set[str], rng: Random
    ) -> bool:
        if not agent.best_match_gaps:
            return False
        rate = agent.learning_rate + (params.training_boost if agent.id in trained_ids else 0.0)
        if rng.random() < min(1.0, rate):
            gap = agent.best_match_gaps[0]
            if gap not in agent.skills:
                agent.skills.append(gap)
                return True
        return False

    def _apply(
        self,
        agent: StudentAgent,
        scorer: FastScorer,
        job_capacities: dict[int, int],
        city_open: bool,
    ) -> None:
        if agent.matched:
            return
        # Apply to the top 3 best-matching jobs (architecture 3.3); a match is
        # achieved when a job scores >= threshold and still has capacity.
        for best_index, score in self._top_available_jobs(
            scorer, agent, job_capacities, city_open
        ):
            if score >= READINESS_THRESHOLD:
                agent.matched = True
                job_capacities[best_index] -= 1
                return

    @staticmethod
    def _top_available_jobs(
        scorer: FastScorer,
        agent: StudentAgent,
        job_capacities: dict[int, int],
        city_open: bool,
    ) -> list[tuple[int, int]]:
        """Top 3 available jobs as (index, score), highest score first."""
        scored: list[tuple[int, int]] = []
        for index, job in enumerate(scorer._jobs):
            if not city_open and job.city != _normalize_city(agent.target_city):
                continue
            if job_capacities.get(index, 0) <= 0:
                continue
            result = scorer.score_job(agent, job)
            scored.append((index, result.score))
        scored.sort(key=lambda item: item[1], reverse=True)
        return scored[:3]

    def _risk(self, agent: StudentAgent):
        return assess_risk(
            RiskInput(
                has_profile=True,
                skill_count=len(agent.skills),
                project_count=len(agent.projects),
                job_stage=agent.stage,
                best_match_score=agent.best_match_score,
                best_match_gap_count=len(agent.best_match_gaps),
                best_match_gaps=agent.best_match_gaps,
                has_plan=True,
                days_since_update=0,
                months_to_graduation=max(0, round(agent.months_to_graduation)),
            )
        )

    def _aggregate_weekly(
        self, weekly_runs: list[list[WeekMetric]], params: SimulationParams
    ) -> list[WeekMetric]:
        aggregated: list[WeekMetric] = []
        for week in range(params.weeks + 1):
            aggregated.append(
                WeekMetric(
                    week=week,
                    readiness_rate=mean(run[week].readiness_rate for run in weekly_runs),
                    matched_rate=mean(run[week].matched_rate for run in weekly_runs),
                    high_risk_count=round(mean(run[week].high_risk_count for run in weekly_runs)),
                    avg_gap=mean(run[week].avg_gap for run in weekly_runs),
                    counselor_utilization=mean(
                        run[week].counselor_utilization for run in weekly_runs
                    ),
                )
            )
        return aggregated

    def _summarize(
        self, weekly_runs: list[list[WeekMetric]], params: SimulationParams
    ) -> dict[str, dict[str, float]]:
        final_week = params.weeks
        summary: dict[str, dict[str, float]] = {}
        for metric in METRICS:
            samples = [getattr(run[final_week], metric) for run in weekly_runs]
            summary[metric] = _mean_ci(samples)
        return summary

    def _top_skill_gaps(
        self,
        supplies: list[dict[str, int]],
        jobs: list[JobTemplate],
    ) -> list[dict[str, object]]:
        # Demand: job capacity-weighted required skills.
        demand: dict[str, int] = {}
        for job in jobs:
            for skill in job.required_skills:
                demand[skill] = demand.get(skill, 0) + job.capacity

        # Supply: mean number of students who mastered each skill across replications.
        all_skills = set(demand)
        for supply in supplies:
            all_skills.update(supply)
        mean_supply: dict[str, float] = {}
        for skill in all_skills:
            mean_supply[skill] = mean(s.get(skill, 0) for s in supplies) if supplies else 0.0

        gaps = [
            {
                "skill": skill,
                "demand": demand.get(skill, 0),
                "supply": round(mean_supply[skill], 1),
                "gap": demand.get(skill, 0) - mean_supply[skill],
            }
            for skill in all_skills
        ]
        gaps.sort(key=lambda item: float(item["gap"]), reverse=True)
        return gaps[:10]


def _normalize_city(value: str) -> str:
    return " ".join(value.casefold().strip().split())


def _agent_rng(run_seed: int, agent_index: int, week: int) -> Random:
    """Deterministic per-agent, per-week RNG with a collision-free string seed.

    The previous integer derivation ``run_seed*1_000_000 + index*10_000 + week``
    collided across replications: the ``i+100``-th student of replication ``r``
    shared a random stream with the ``i``-th student of replication ``r+1``.
    A colon-delimited string seed guarantees distinct streams per
    (run_seed, agent_index, week) triple.
    """
    return Random(f"{run_seed}:{agent_index}:{week}")


def _mean_ci(samples: list[float]) -> dict[str, float]:
    n = len(samples)
    avg = mean(samples) if samples else 0.0
    if n > 1:
        sd = sqrt(sum((x - avg) ** 2 for x in samples) / (n - 1))
        margin = 1.96 * sd / sqrt(n)
    else:
        margin = 0.0
    return {"mean": avg, "ci_low": avg - margin, "ci_high": avg + margin}


def _scenario_to_dict(result: ScenarioResult) -> dict[str, object]:
    return {
        "scenario": result.scenario,
        "weeks": [
            {
                "week": week.week,
                "readiness_rate": week.readiness_rate,
                "matched_rate": week.matched_rate,
                "high_risk_count": week.high_risk_count,
                "avg_gap": week.avg_gap,
                "counselor_utilization": week.counselor_utilization,
            }
            for week in result.weeks
        ],
        "summary": result.summary,
        "top_skill_gaps": result.top_skill_gaps,
    }
