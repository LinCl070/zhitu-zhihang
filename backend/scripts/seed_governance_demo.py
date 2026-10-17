"""Seed synthetic accounts for the governance-agent defense demo.

Creates one counselor and six students with clearly fake names, authorizes them to the
counselor, and shapes their profiles so the risk board shows high / medium / low cases.
No phone, email, or student number is stored. Re-running only refreshes the demo rows.

Run after migrations, with the shared demo password supplied by the environment:
    DEMO_ACCOUNT_PASSWORD=... python -m scripts.seed_governance_demo
"""

import os
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from app.auth.passwords import hash_password
from app.db.session import get_session_factory
from app.models.entities import (
    ActionPlan,
    CareerProfile,
    CounselorStudentAccess,
    JobPosting,
    JobStage,
    MatchResult,
    User,
    UserRole,
)
from app.services.career import create_action_plan
from app.services.matching import MatchingService
from app.services.risk import assess_risk, build_risk_input
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

COUNSELOR_USERNAME = "demo_teacher"


@dataclass(frozen=True)
class DemoStudent:
    username: str
    display_name: str
    enrollment_year: int
    major: str | None  # None = no career profile yet
    skills: tuple[str, ...] = ()
    projects: tuple[str, ...] = ()
    target_roles: tuple[str, ...] = ()
    target_cities: tuple[str, ...] = ("成都",)
    job_stage: JobStage = JobStage.EXPLORING
    stale_days: int = 0
    with_plan: bool = False


# Graduation is enrollment_year + 4 on July 1, so 2023 cohorts graduate on 2027-07-01.
STUDENTS = (
    DemoStudent("demo_student_a", "演示学生A", 2023, "软件工程", ("Python",),
                target_roles=("后端开发",), stale_days=45),
    DemoStudent("demo_student_b", "演示学生B", 2023, "网络空间安全", ("Linux", "网络基础"),
                target_roles=("网络安全",)),
    DemoStudent("demo_student_c", "演示学生C", 2023, None),
    DemoStudent("demo_student_d", "演示学生D", 2023, "数据科学", ("Python", "SQL", "Pandas"),
                ("数据清洗课程项目",), ("数据分析",), job_stage=JobStage.PREPARING),
    DemoStudent("demo_student_e", "演示学生E", 2023, "计算机科学", ("JavaScript", "React"),
                target_roles=("前端开发",), job_stage=JobStage.PREPARING),
    DemoStudent("demo_student_f", "演示学生F", 2023, "软件工程",
                ("Python", "SQL", "Git", "REST API"), ("接口设计与数据服务项目",),
                ("后端开发",), job_stage=JobStage.APPLYING, with_plan=True),
)


def _upsert_user(session: Session, username: str, display_name: str, role: UserRole,
                 password_hash: str, enrollment_year: int | None = None) -> User:
    user = session.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(username=username, role=role, password_hash=password_hash,
                    password_changed_at=datetime.now(UTC))
        session.add(user)
    user.display_name = display_name
    user.enrollment_year = enrollment_year
    user.is_active = True
    user.failed_login_count = 0
    user.locked_until = None
    session.flush()
    return user


def _reset_student(session: Session, user: User, spec: DemoStudent,
                   jobs: list[JobPosting]) -> None:
    session.execute(delete(ActionPlan).where(ActionPlan.student_id == user.id))
    profile = session.scalar(select(CareerProfile).where(CareerProfile.student_id == user.id))
    if profile is not None:
        session.execute(delete(MatchResult).where(MatchResult.profile_id == profile.id))
        session.delete(profile)
        session.flush()
    if spec.major is None:
        return

    profile = CareerProfile(
        student_id=user.id, major=spec.major, skills=list(spec.skills),
        projects=list(spec.projects), target_roles=list(spec.target_roles),
        target_cities=list(spec.target_cities), job_stage=spec.job_stage,
    )
    session.add(profile)
    session.flush()
    # Set after insert so onupdate does not overwrite the backdated timestamp.
    profile.updated_at = datetime.now(UTC) - timedelta(days=spec.stale_days)
    session.flush()

    if spec.with_plan:
        best = MatchingService().match(profile, jobs)[0]
        match = MatchResult(profile_id=profile.id, job_id=best.job_id, score=best.score,
                            score_breakdown=best.score_breakdown, gaps=best.gaps)
        session.add(match)
        session.flush()
        create_action_plan(session, student_id=user.id, match=match)


def main() -> None:
    password = os.getenv("DEMO_ACCOUNT_PASSWORD", "")
    if not password:
        raise SystemExit("DEMO_ACCOUNT_PASSWORD is required")
    password_hash = hash_password(password)

    session = get_session_factory()()
    try:
        jobs = list(session.scalars(select(JobPosting)).all())
        counselor = _upsert_user(session, COUNSELOR_USERNAME, "演示教师", UserRole.COUNSELOR,
                                 password_hash)
        for spec in STUDENTS:
            student = _upsert_user(session, spec.username, spec.display_name, UserRole.STUDENT,
                                   password_hash, spec.enrollment_year)
            _reset_student(session, student, spec, jobs)
            granted = session.scalar(select(CounselorStudentAccess.id).where(
                CounselorStudentAccess.counselor_id == counselor.id,
                CounselorStudentAccess.student_id == student.id,
            ))
            if granted is None:
                session.add(CounselorStudentAccess(counselor_id=counselor.id,
                                                   student_id=student.id))
        session.commit()

        today = date.today()
        for spec in STUDENTS:
            student = session.scalar(select(User).where(User.username == spec.username))
            result = assess_risk(build_risk_input(session, student, today))
            print(f"{spec.display_name}: {result.score} {result.level} {result.factors}")
        print(f"Seeded counselor '{COUNSELOR_USERNAME}' with {len(STUDENTS)} students.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
