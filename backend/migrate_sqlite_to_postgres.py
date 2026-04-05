import json
import sqlite3
from pathlib import Path

from services.database_service import (
    get_connection,
    replace_master_students,
    replace_placed_students,
    store_uploaded_applicants,
)


SQLITE_PATH = Path(__file__).resolve().parent / "data" / "internship_manager.db"


def read_sqlite_rows():
    if not SQLITE_PATH.exists():
        raise FileNotFoundError(f"SQLite database not found at {SQLITE_PATH}")

    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        master_rows = [
            {"bt_id": row["bt_id"], "name": row["name"], "cgpa": row["cgpa"]}
            for row in conn.execute("SELECT bt_id, name, cgpa FROM master_students ORDER BY bt_id").fetchall()
        ]
        placed_rows = [
            {
                "bt_id": row["bt_id"],
                "name": row["name"],
                "company": row["company"],
                "job_profile": row["job_profile"],
                "duration": row["duration"],
                "stipend": row["stipend"],
            }
            for row in conn.execute(
                "SELECT bt_id, name, company, job_profile, duration, stipend FROM placed_students ORDER BY bt_id"
            ).fetchall()
        ]
        applicant_rows = []
        for row in conn.execute("SELECT raw_data FROM uploaded_applicants ORDER BY bt_id").fetchall():
            applicant_rows.append(json.loads(row["raw_data"]) if row["raw_data"] else {})

        meta_rows = {
            row["key"]: json.loads(row["value"])
            for row in conn.execute("SELECT key, value FROM app_meta").fetchall()
        }
    finally:
        conn.close()

    return master_rows, placed_rows, applicant_rows, meta_rows


def write_postgres(master_rows, placed_rows, applicant_rows, meta_rows):
    replace_master_students(master_rows, source_filename=meta_rows.get("master_source_filename"))
    replace_placed_students(placed_rows, source_filename=meta_rows.get("placed_source_filename"))
    store_uploaded_applicants(
        applicant_rows,
        source_filename=meta_rows.get("applicants_source_filename"),
        columns=meta_rows.get("applicants_columns", []),
    )

    with get_connection() as conn:
        for key in ["master_updated_at", "placed_updated_at", "applicants_updated_at"]:
            value = meta_rows.get(key)
            if value is None:
                continue
            conn.execute(
                """
                INSERT INTO app_meta(key, value)
                VALUES (%s, %s)
                ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
                """,
                (key, json.dumps(value)),
            )


def main():
    master_rows, placed_rows, applicant_rows, meta_rows = read_sqlite_rows()
    write_postgres(master_rows, placed_rows, applicant_rows, meta_rows)
    print(
        f"Migrated {len(master_rows)} master rows, {len(placed_rows)} placed rows, "
        f"and {len(applicant_rows)} uploaded applicant rows from SQLite to PostgreSQL."
    )


if __name__ == "__main__":
    main()
