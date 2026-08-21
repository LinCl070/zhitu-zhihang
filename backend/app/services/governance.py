"""Read-only, non-secret views of the approved local governance registry."""

import csv
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SOURCE_REGISTRY = PROJECT_ROOT / "docs" / "knowledge-base" / "source-registry.csv"


def read_source_registry() -> list[dict[str, str]]:
    with SOURCE_REGISTRY.open(encoding="utf-8", newline="") as csv_file:
        return [
            {
                "asset_id": row["asset_id"],
                "title": row["title"],
                "status": row["status"],
                "published_on": row["published_on"],
                "effective_until": row["effective_until"],
                "applicable_scope": row["applicable_scope"],
            }
            for row in csv.DictReader(csv_file)
        ]
