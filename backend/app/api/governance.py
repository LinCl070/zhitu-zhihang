"""Employment governance endpoints: risk warnings, insights, simulation, and reports."""

from datetime import UTC, date, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select

from app.auth.session import DbSession, SessionPrincipal, require_roles
from app.config import get_settings
from app.models.entities import (
    CareerProfile,
    CounselorStudentAccess,
    SimulationRun,
    User,
    UserRole,
)
from app.services.assistant import create_assistant_service
from app.services.audit import record_audit_event
from app.services.insights import build_insights
from app.services.risk import RiskAssessment, assess_risk, build_risk_input
from app.services.simulation.engine import (
    COHORT_DEFAULT,
    COHORT_MAX,
    COHORT_MIN,
    REPLICATIONS_DEFAULT,
    REPLICATIONS_MAX,
    REPLICATIONS_MIN,
    SCENARIOS,
    WEEKS_DEFAULT,
    WEEKS_MAX,
    WEEKS_MIN,
    SimulationEngine,
    SimulationParams,
)
from app.services.simulation.report import build_report

router = APIRouter(prefix="/api/v1/governance", tags=["governance"])
CounselorPrincipal = Annotated[SessionPrincipal, Depends(require_roles(UserRole.COUNSELOR))]
AdminPrincipal = Annotated[SessionPrincipal, Depends(require_roles(UserRole.ADMIN))]


class RiskItem(BaseModel):
    student_id: UUID
    display_name: str
    major: str
    job_stage: str | None
    score: int
    level: str
    factors: dict[str, int]
    reasons: list[str]
    actions: list[str]


class InsightsResponse(BaseModel):
    source: str
    synthetic: bool
    groups: list[dict[str, object]]
    total_count: int


class SimulationDefaultsResponse(BaseModel):
    cohort_size: dict[str, int]
    weeks: dict[str, int]
    replications: dict[str, int]
    scenarios: list[str]


class SimulationCreatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cohort_size: int = Field(default=COHORT_DEFAULT, ge=COHORT_MIN, le=COHORT_MAX)
    weeks: int = Field(default=WEEKS_DEFAULT, ge=WEEKS_MIN, le=WEEKS_MAX)
    replications: int = Field(
        default=REPLICATIONS_DEFAULT, ge=REPLICATIONS_MIN, le=REPLICATIONS_MAX
    )
    seed: int = Field(default=1, ge=1, le=1_000_000)
    counselor_count: int = Field(default=4, ge=0, le=100)
    sessions_per_week: int = Field(default=8, ge=1, le=40)
    supply_ratio: float = Field(default=0.8, ge=0.0, le=2.0)
    scenarios: list[str] = Field(default=["baseline"], min_length=1, max_length=4)

    @field_validator("scenarios")
    @classmethod
    def validate_scenarios(cls, value: list[str]) -> list[str]:
        if "baseline" not in value:
            raise ValueError("scenarios 必须包含 baseline")
        unknown = [scenario for scenario in value if scenario not in SCENARIOS]
        if unknown:
            raise ValueError(f"未知场景：{', '.join(unknown)}")
        return value


class SimulationSummaryResponse(BaseModel):
    id: UUID
    created_at: str
    model_version: str
    seed: int
    cohort_size: int
    scenarios: list[str]
    adopted_scenario: str | None


class SimulationDetailResponse(BaseModel):
    id: UUID
    created_at: str
    model_version: str
    seed: int
    params: dict
    results: dict
    adopted_scenario: str | None


class AdoptPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario: str


class ReportResponse(BaseModel):
    ranking: list[dict[str, object]]
    findings: list[str]
    recommendation: str
    caveats: list[str]
    ai_narrative: str | None = None
    requires_review: bool = False


@router.get("/counselor/risks", response_model=list[RiskItem])
def read_counselor_risks(
    principal: CounselorPrincipal, session: DbSession
) -> list[RiskItem]:
    """Return authorized students ordered by descending risk score."""
    access_rows = session.scalars(
        select(CounselorStudentAccess).where(
            CounselorStudentAccess.counselor_id == principal.user_id
        )
    ).all()
    student_ids = [row.student_id for row in access_rows]

    users = {
        user.id: user
        for user in session.scalars(select(User).where(User.id.in_(student_ids))).all()
    }
    profiles = {
        profile.student_id: profile
        for profile in session.scalars(
            select(CareerProfile).where(CareerProfile.student_id.in_(student_ids))
        ).all()
    }

    items: list[RiskItem] = []
    for student_id in student_ids:
        user = users.get(student_id)
        if user is None:
            continue
        as_of = date.today()
        risk_input = build_risk_input(session, user, as_of)
        assessment: RiskAssessment = assess_risk(risk_input)
        profile = profiles.get(student_id)
        items.append(
            RiskItem(
                student_id=student_id,
                display_name=user.display_name,
                major=profile.major if profile else "未设置",
                job_stage=profile.job_stage.value if profile else None,
                score=assessment.score,
                level=assessment.level,
                factors=assessment.factors,
                reasons=assessment.reasons,
                actions=assessment.actions,
            )
        )

    items.sort(key=lambda item: item.score, reverse=True)
    return items


@router.get("/admin/insights", response_model=InsightsResponse)
def read_admin_insights(
    _: AdminPrincipal,
    session: DbSession,
    source: Literal["live", "synthetic"] = Query(default="live"),
    seed: int = Query(default=1, ge=1, le=1_000_000),
    cohort_size: int = Query(default=COHORT_DEFAULT, ge=COHORT_MIN, le=COHORT_MAX),
) -> InsightsResponse:
    payload = build_insights(session, source=source, seed=seed, cohort_size=cohort_size)
    return InsightsResponse(**payload)


@router.get("/admin/simulations/defaults", response_model=SimulationDefaultsResponse)
def read_simulation_defaults(_: AdminPrincipal) -> SimulationDefaultsResponse:
    return SimulationDefaultsResponse(
        cohort_size={"default": COHORT_DEFAULT, "min": COHORT_MIN, "max": COHORT_MAX},
        weeks={"default": WEEKS_DEFAULT, "min": WEEKS_MIN, "max": WEEKS_MAX},
        replications={
            "default": REPLICATIONS_DEFAULT,
            "min": REPLICATIONS_MIN,
            "max": REPLICATIONS_MAX,
        },
        scenarios=list(SCENARIOS),
    )


@router.post("/admin/simulations", response_model=SimulationSummaryResponse)
def create_simulation(
    payload: SimulationCreatePayload,
    principal: AdminPrincipal,
    session: DbSession,
) -> SimulationSummaryResponse:
    params = SimulationParams(
        cohort_size=payload.cohort_size,
        weeks=payload.weeks,
        replications=payload.replications,
        counselor_count=payload.counselor_count,
        sessions_per_week=payload.sessions_per_week,
        supply_ratio=payload.supply_ratio,
        seed=payload.seed,
        scenarios=tuple(payload.scenarios),
    )
    results = SimulationEngine().run(params)

    run = SimulationRun(
        created_by=principal.user_id,
        params={
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
        seed=payload.seed,
        model_version=results["model_version"],
        results=results,
    )
    session.add(run)
    session.flush()
    record_audit_event(
        session,
        actor_id=principal.user_id,
        actor_role=principal.role,
        action="simulation_run_created",
        resource_type="simulation_run",
        resource_id=run.id,
        metadata={
            "scenarios": ",".join(payload.scenarios),
            "cohort_size": str(payload.cohort_size),
        },
    )
    session.commit()
    return SimulationSummaryResponse(
        id=run.id,
        created_at=run.created_at.isoformat(),
        model_version=run.model_version,
        seed=run.seed,
        cohort_size=payload.cohort_size,
        scenarios=list(payload.scenarios),
        adopted_scenario=run.adopted_scenario,
    )


@router.get("/admin/simulations", response_model=list[SimulationSummaryResponse])
def list_simulations(_: AdminPrincipal, session: DbSession) -> list[SimulationSummaryResponse]:
    runs = session.scalars(
        select(SimulationRun).order_by(SimulationRun.created_at.desc()).limit(20)
    ).all()
    return [
        SimulationSummaryResponse(
            id=run.id,
            created_at=run.created_at.isoformat(),
            model_version=run.model_version,
            seed=run.seed,
            cohort_size=run.params.get("cohort_size", 0),
            scenarios=run.params.get("scenarios", []),
            adopted_scenario=run.adopted_scenario,
        )
        for run in runs
    ]


@router.get("/admin/simulations/{run_id}", response_model=SimulationDetailResponse)
def read_simulation(
    run_id: UUID, _: AdminPrincipal, session: DbSession
) -> SimulationDetailResponse:
    run = session.get(SimulationRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found")
    return SimulationDetailResponse(
        id=run.id,
        created_at=run.created_at.isoformat(),
        model_version=run.model_version,
        seed=run.seed,
        params=run.params,
        results=run.results,
        adopted_scenario=run.adopted_scenario,
    )


@router.post("/admin/simulations/{run_id}/report", response_model=ReportResponse)
async def generate_simulation_report(
    run_id: UUID, _: AdminPrincipal, session: DbSession
) -> ReportResponse:
    run = session.get(SimulationRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found")
    report = build_report(run.results)

    ai_narrative: str | None = None
    requires_review = False
    try:
        from app.clients.fastgpt import AssistantRoute

        service = create_assistant_service(get_settings())
        context = {
            "ranking": report["ranking"],
            "findings": report["findings"],
        }
        response = await service.query(
            AssistantRoute.POLICY, "请解读本次就业治理策略仿真结果。", context=context
        )
        ai_narrative, requires_review = _ai_narrative_from_response(response)
    except Exception:
        ai_narrative = None

    return ReportResponse(
        ranking=report["ranking"],
        findings=report["findings"],
        recommendation=report["recommendation"],
        caveats=report["caveats"],
        ai_narrative=ai_narrative,
        requires_review=requires_review,
    )


def _ai_narrative_from_response(response: object) -> tuple[str | None, bool]:
    """Return (narrative, requires_review) from an assistant response; handoffs yield none."""
    answer = getattr(response, "answer", None)
    handoff = getattr(response, "handoff_recommended", False)
    if answer and not handoff:
        return answer, True
    return None, False


@router.post("/admin/simulations/{run_id}/adopt", response_model=dict[str, str])
def adopt_simulation(
    run_id: UUID,
    payload: AdoptPayload,
    principal: AdminPrincipal,
    session: DbSession,
) -> dict[str, str]:
    run = session.get(SimulationRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found")
    if payload.scenario not in run.results.get("scenarios", {}):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown scenario"
        )
    run.adopted_scenario = payload.scenario
    run.adopted_at = datetime.now(UTC)
    record_audit_event(
        session,
        actor_id=principal.user_id,
        actor_role=principal.role,
        action="governance_strategy_adopted",
        resource_type="simulation_run",
        resource_id=run.id,
        metadata={"scenario": payload.scenario},
    )
    session.commit()
    return {"status": "adopted", "scenario": payload.scenario}


@router.get("/admin/datasets/synthetic.csv", response_class=PlainTextResponse)
def export_synthetic_dataset(
    _: AdminPrincipal,
    seed: int = Query(default=1, ge=1, le=1_000_000),
    cohort_size: int = Query(default=COHORT_DEFAULT, ge=COHORT_MIN, le=COHORT_MAX),
) -> PlainTextResponse:
    from app.services.simulation.cohort import generate_cohort

    agents = generate_cohort(cohort_size, seed)
    header = "id,major,skills,projects,target_role,target_city,stage\n"
    rows = [
        ",".join(
            [
                agent.id,
                agent.major,
                "|".join(agent.skills),
                "|".join(agent.projects),
                agent.target_role,
                agent.target_city,
                agent.stage.value,
            ]
        )
        for agent in agents
    ]
    content = header + "\n".join(rows) + "\n"
    return PlainTextResponse(content=content, media_type="text/csv")
