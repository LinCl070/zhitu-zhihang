"""Read-only, non-secret views of the approved local governance registry."""

import csv
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SOURCE_REGISTRY = PROJECT_ROOT / "docs" / "knowledge-base" / "source-registry.csv"


def _get_registry_path() -> Path:
    if SOURCE_REGISTRY.is_file():
        return SOURCE_REGISTRY
    cwd_candidate = Path.cwd() / "docs" / "knowledge-base" / "source-registry.csv"
    if cwd_candidate.is_file():
        return cwd_candidate
    return SOURCE_REGISTRY


def read_source_registry() -> list[dict[str, str]]:
    target = _get_registry_path()
    if not target.is_file():
        return []

    with target.open(encoding="utf-8-sig", newline="") as csv_file:
        return [
            {
                "asset_id": row["asset_id"],
                "asset_type": row.get("asset_type", "资料"),
                "title": row["title"],
                "status": row["status"],
                "published_on": row["published_on"],
                "effective_until": row["effective_until"],
                "applicable_scope": row["applicable_scope"],
                "source_uri_or_file": row.get("source_uri_or_file", ""),
                "version": row.get("version", ""),
            }
            for row in csv.DictReader(csv_file)
            if row.get("asset_id")
        ]
