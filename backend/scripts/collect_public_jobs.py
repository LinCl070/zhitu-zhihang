"""Collect a bounded, reviewable public job snapshot from NCSS."""

import csv
import re
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = PROJECT_ROOT / "docs" / "data-governance" / "public-job-postings.csv"
NCSS_LIST_URL = "https://www.ncss.cn/student/jobs/jobslist/ajax/"
NCSS_DETAIL_URL = "https://www.ncss.cn/student/jobs/{job_id}/detail.html"
SOURCE_ASSET_ID = "SRC-NCSS-PUBLIC-JOBS-20260805"
SOURCE_TITLE = "国家大学生就业服务平台公开岗位"
FRESHNESS_WINDOW = timedelta(days=7)
HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.ncss.cn/student/jobs/index.html",
    "User-Agent": "Mozilla/5.0 (compatible; CareerNavigator/1.0; public-data-review)",
}
SKILL_PATTERNS = {
    "Python": ("python",),
    "Java": ("java",),
    "JavaScript": ("javascript", "js"),
    "TypeScript": ("typescript",),
    "C/C++": ("c/c++", "c++", "嵌入式c"),
    "SQL": ("sql", "数据库"),
    "Linux": ("linux",),
    "Docker": ("docker",),
    "Git": ("git",),
    "前端开发": ("前端", "web开发"),
    "数据分析": ("数据分析", "数据处理"),
    "物联网": ("物联网",),
}
FIELDNAMES = (
    "job_id",
    "title",
    "employer_name",
    "city",
    "employment_type",
    "required_skills",
    "preferred_majors",
    "project_signals",
    "source_asset_id",
    "source_title",
    "source_url",
    "published_on",
    "valid_until",
    "status",
    "demo_only",
    "notes",
)


def collect(limit: int = 20) -> list[dict[str, str]]:
    """Fetch a current public snapshot without submitting or authenticating."""

    params = {
        "jobType": "",
        "areaCode": "",
        "jobName": "开发",
        "monthPay": "",
        "industrySectors": "",
        "recruitType": "",
        "property": "",
        "categoryCode": "",
        "memberLevel": "",
        "offset": "1",
        "limit": str(limit * 2),
        "keyUnits": "",
        "degreeCode": "",
        "sourcesName": "",
        "sourcesType": "",
    }
    with httpx.Client(headers=HEADERS, timeout=20.0, follow_redirects=True) as client:
        response = client.get(NCSS_LIST_URL, params=params)
        response.raise_for_status()
        payload = response.json()
        jobs = payload.get("data", {}).get("list", [])
        rows = [_build_row(client, job) for job in jobs if isinstance(job, dict)]
    return [row for row in rows if row is not None][:limit]


def write_snapshot(rows: list[dict[str, str]]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def _build_row(client: httpx.Client, job: dict[str, Any]) -> dict[str, str] | None:
    job_id = _text(job.get("jobId"))
    title = _text(job.get("jobName"))
    employer_name = _text(job.get("recName"))
    if not all((job_id, title, employer_name)):
        return None

    source_url = NCSS_DETAIL_URL.format(job_id=job_id)
    detail = client.get(source_url)
    detail.raise_for_status()
    detail_text = re.sub(r"<[^>]+>", " ", detail.text)
    skills = _extract_skills(detail_text)
    published_on = _epoch_date(job.get("publishDate"))
    return {
        "job_id": f"NCSS-{job_id}",
        "title": title,
        "employer_name": employer_name,
        "city": _text(job.get("areaCodeName")) or "地区未公开",
        "employment_type": "全职",
        "required_skills": ";".join(skills),
        "preferred_majors": ";".join(_split_majors(_text(job.get("major")))),
        "project_signals": _project_signals(skills),
        "source_asset_id": SOURCE_ASSET_ID,
        "source_title": SOURCE_TITLE,
        "source_url": source_url,
        "published_on": published_on.isoformat(),
        "valid_until": (published_on + FRESHNESS_WINDOW).isoformat(),
        "status": "published",
        "demo_only": "false",
        "notes": "公开列表在采集日可访问；有效期为本系统信息复核日期，不代表招聘方报名截止日期。",
    }


def _extract_skills(detail_text: str) -> list[str]:
    normalized = detail_text.casefold()
    return [
        skill
        for skill, patterns in SKILL_PATTERNS.items()
        if any(pattern in normalized for pattern in patterns)
    ]


def _project_signals(skills: list[str]) -> str:
    if "前端开发" in skills:
        return "前端项目"
    if "数据分析" in skills:
        return "数据分析项目"
    if "物联网" in skills:
        return "物联网项目"
    return "软件开发项目"


def _split_majors(value: str) -> list[str]:
    return [major for major in re.split(r"[\s,，/]+", value) if major]


def _epoch_date(value: object) -> date:
    if not isinstance(value, (int, float)):
        raise ValueError("NCSS job record was missing publishDate")
    return datetime.fromtimestamp(value / 1000, tz=UTC).date()


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


if __name__ == "__main__":
    snapshot = collect()
    if len(snapshot) < 20:
        raise SystemExit("NCSS returned fewer than 20 reviewable public jobs")
    write_snapshot(snapshot)
    print(f"Wrote {len(snapshot)} public job records to {OUTPUT_PATH}")
