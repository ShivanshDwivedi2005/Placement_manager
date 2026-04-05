import json
import math
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional

import psycopg
from psycopg import sql
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import settings


_pool: Optional[ConnectionPool] = None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def open_db_pool():
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=settings.database_url,
            min_size=settings.db_pool_min_size,
            max_size=settings.db_pool_max_size,
            timeout=settings.db_pool_timeout,
            kwargs={"row_factory": dict_row},
            open=False,
        )
    if _pool.closed:
        _pool.open(wait=True)


def close_db_pool():
    global _pool
    if _pool is not None and not _pool.closed:
        _pool.close()


@contextmanager
def get_connection():
    if _pool is None or _pool.closed:
        open_db_pool()
    conn = _pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)


def _ensure_column(conn, table_name: str, column_name: str, column_type: str):
    conn.execute(
        sql.SQL("ALTER TABLE {} ADD COLUMN IF NOT EXISTS {} {}").format(
            sql.Identifier(table_name),
            sql.Identifier(column_name),
            sql.SQL(column_type),
        )
    )


def init_db():
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS placed_students (
                bt_id TEXT PRIMARY KEY,
                name TEXT,
                company TEXT,
                job_profile TEXT,
                duration TEXT,
                stipend TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS master_students (
                bt_id TEXT PRIMARY KEY,
                name TEXT,
                cgpa DOUBLE PRECISION,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS uploaded_applicants (
                bt_id TEXT PRIMARY KEY,
                raw_data TEXT,
                uploaded_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS app_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS download_history (
                id BIGSERIAL PRIMARY KEY,
                filename TEXT NOT NULL,
                filters_json TEXT NOT NULL,
                columns_json TEXT NOT NULL,
                rows_json TEXT NOT NULL,
                row_count INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        _ensure_column(conn, "placed_students", "duration", "TEXT")
        _ensure_column(conn, "placed_students", "job_profile", "TEXT")
        _ensure_column(conn, "uploaded_applicants", "raw_data", "TEXT")
        conn.execute("UPDATE master_students SET cgpa = NULL WHERE cgpa = 'NaN'::float8")


def _set_meta(conn, key: str, value):
    conn.execute(
        """
        INSERT INTO app_meta(key, value)
        VALUES (%s, %s)
        ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
        """,
        (key, json.dumps(value)),
    )


def _get_meta(conn, key: str, default=None):
    row = conn.execute("SELECT value FROM app_meta WHERE key = %s", (key,)).fetchone()
    if not row:
        return default
    return json.loads(row["value"])


def _normalize_bt_id(value: str) -> str:
    return str(value or "").strip().upper()


def _normalize_float(value):
    if value is None:
        return None
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def _json_safe(value):
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def replace_master_students(students: Iterable[Dict], source_filename: Optional[str] = None) -> int:
    now = utc_now_iso()
    rows = []
    for student in students:
        bt_id = _normalize_bt_id(student.get("bt_id"))
        if not bt_id:
            continue
        rows.append((bt_id, student.get("name"), _normalize_float(student.get("cgpa")), now, now))

    with get_connection() as conn:
        conn.execute("DELETE FROM master_students")
        if rows:
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO master_students(bt_id, name, cgpa, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    rows,
                )
        _set_meta(conn, "master_updated_at", now)
        _set_meta(conn, "master_source_filename", source_filename or "")
    return len(rows)


def replace_placed_students(students: Iterable[Dict], source_filename: Optional[str] = None) -> int:
    now = utc_now_iso()
    rows = []
    for student in students:
        bt_id = _normalize_bt_id(student.get("bt_id"))
        if not bt_id:
            continue
        rows.append(
            (
                bt_id,
                student.get("name"),
                student.get("company"),
                student.get("job_profile"),
                student.get("duration"),
                str(student.get("stipend", "") or ""),
                now,
                now,
            )
        )

    with get_connection() as conn:
        conn.execute("DELETE FROM placed_students")
        if rows:
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO placed_students(bt_id, name, company, job_profile, duration, stipend, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    rows,
                )
        _set_meta(conn, "placed_updated_at", now)
        _set_meta(conn, "placed_source_filename", source_filename or "")
    return len(rows)


def store_uploaded_applicants(
    applicants: Iterable[Dict],
    source_filename: Optional[str] = None,
    columns: Optional[List[str]] = None,
) -> int:
    now = utc_now_iso()
    rows = []
    for applicant in applicants:
        bt_id = _normalize_bt_id(applicant.get("bt_id"))
        if not bt_id:
            continue
        payload = dict(applicant)
        payload["bt_id"] = bt_id
        rows.append((bt_id, json.dumps(_json_safe(payload)), now))

    with get_connection() as conn:
        conn.execute("DELETE FROM uploaded_applicants")
        if rows:
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO uploaded_applicants(bt_id, raw_data, uploaded_at)
                    VALUES (%s, %s, %s)
                    """,
                    rows,
                )
        _set_meta(conn, "applicants_updated_at", now)
        _set_meta(conn, "applicants_source_filename", source_filename or "")
        _set_meta(conn, "applicants_columns", columns or [])
    return len(rows)


def get_placed_students() -> List[Dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT bt_id, name, company, job_profile, duration, stipend
            FROM placed_students
            ORDER BY bt_id
            """
        ).fetchall()
    return [
        _json_safe(
            {
                "BT-ID": row["bt_id"],
                "Name": row["name"],
                "Company": row["company"],
                "Job Profile": row["job_profile"],
                "Duration": row["duration"],
                "Stipend": row["stipend"],
            }
        )
        for row in rows
    ]


def get_master_students() -> List[Dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT bt_id, name, cgpa
            FROM master_students
            ORDER BY bt_id
            """
        ).fetchall()
    return [
        _json_safe(
            {
                "BT-ID": row["bt_id"],
                "Name": row["name"],
                "CGPA": row["cgpa"],
            }
        )
        for row in rows
    ]


def get_uploaded_applicants() -> List[Dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT bt_id, raw_data
            FROM uploaded_applicants
            ORDER BY bt_id
            """
        ).fetchall()

    applicants = []
    for row in rows:
        if row["raw_data"]:
            payload = json.loads(row["raw_data"])
            payload["bt_id"] = _normalize_bt_id(payload.get("bt_id"))
            applicants.append(_json_safe(payload))
        else:
            applicants.append({"bt_id": row["bt_id"]})
    return applicants


def get_uploaded_applicant_columns() -> List[str]:
    with get_connection() as conn:
        return _get_meta(conn, "applicants_columns", [])


def save_download_history(
    filename: str,
    filters_used: Dict,
    columns: List[str],
    rows: List[Dict],
) -> int:
    created_at = utc_now_iso()

    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO download_history(filename, filters_json, columns_json, rows_json, row_count, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                filename,
                json.dumps(_json_safe(filters_used)),
                json.dumps(_json_safe(columns)),
                json.dumps(_json_safe(rows)),
                len(rows),
                created_at,
            ),
        )
        entry_id = cursor.fetchone()["id"]

        conn.execute(
            """
            DELETE FROM download_history
            WHERE id NOT IN (
                SELECT id
                FROM download_history
                ORDER BY created_at DESC, id DESC
                LIMIT 5
            )
            """
        )

        return entry_id


def get_recent_download_history() -> List[Dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, filename, filters_json, columns_json, row_count, created_at
            FROM download_history
            ORDER BY created_at DESC, id DESC
            LIMIT 5
            """
        ).fetchall()

    return [
        {
            "id": row["id"],
            "filename": row["filename"],
            "filters": _json_safe(json.loads(row["filters_json"] or "{}")),
            "columns": _json_safe(json.loads(row["columns_json"] or "[]")),
            "row_count": row["row_count"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def get_download_history_entry(entry_id: int) -> Optional[Dict]:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT id, filename, filters_json, columns_json, rows_json, row_count, created_at
            FROM download_history
            WHERE id = %s
            """,
            (entry_id,),
        ).fetchone()

    if not row:
        return None

    return _json_safe(
        {
            "id": row["id"],
            "filename": row["filename"],
            "filters": json.loads(row["filters_json"] or "{}"),
            "columns": json.loads(row["columns_json"] or "[]"),
            "rows": json.loads(row["rows_json"] or "[]"),
            "row_count": row["row_count"],
            "created_at": row["created_at"],
        }
    )


def get_truly_unplaced_students() -> List[Dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT m.bt_id, m.name, m.cgpa
            FROM master_students m
            LEFT JOIN placed_students p ON p.bt_id = m.bt_id
            WHERE p.bt_id IS NULL
            ORDER BY m.bt_id
            """
        ).fetchall()
    return [
        _json_safe(
            {
                "BT-ID": row["bt_id"],
                "Name": row["name"],
                "CGPA": row["cgpa"],
            }
        )
        for row in rows
    ]


def add_placed_student(student: Dict) -> bool:
    bt_id = _normalize_bt_id(student.get("bt_id"))
    if not bt_id:
        return False
    now = utc_now_iso()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO placed_students(bt_id, name, company, job_profile, duration, stipend, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT(bt_id) DO UPDATE SET
                name = EXCLUDED.name,
                company = EXCLUDED.company,
                job_profile = EXCLUDED.job_profile,
                duration = EXCLUDED.duration,
                stipend = EXCLUDED.stipend,
                updated_at = EXCLUDED.updated_at
            """,
            (
                bt_id,
                student.get("name"),
                student.get("company"),
                student.get("job_profile"),
                student.get("duration"),
                str(student.get("stipend", "") or ""),
                now,
                now,
            ),
        )
        _set_meta(conn, "placed_updated_at", now)
    return True


def remove_placed_student(bt_id: str) -> bool:
    normalized = _normalize_bt_id(bt_id)
    with get_connection() as conn:
        result = conn.execute("DELETE FROM placed_students WHERE bt_id = %s", (normalized,))
        if result.rowcount:
            _set_meta(conn, "placed_updated_at", utc_now_iso())
            return True
    return False


def bulk_add_placed_students(students: List[Dict]) -> int:
    count = 0
    for student in students:
        if add_placed_student(student):
            count += 1
    return count


def bulk_remove_placed_students(bt_ids: List[str]) -> Dict[str, int]:
    removed = 0
    not_found = 0
    seen = set()

    for bt_id in bt_ids:
        normalized = _normalize_bt_id(bt_id)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        if remove_placed_student(normalized):
            removed += 1
        else:
            not_found += 1

    return {"removed": removed, "not_found": not_found}


def get_last_sync() -> Optional[str]:
    status = get_storage_status()
    timestamps = [
        status["placed_updated_at"],
        status["master_updated_at"],
        status["applicants_updated_at"],
    ]
    timestamps = [value for value in timestamps if value]
    return max(timestamps) if timestamps else None


def get_storage_status() -> Dict:
    with get_connection() as conn:
        counts = {
            "placed_count": conn.execute("SELECT COUNT(*) AS count FROM placed_students").fetchone()["count"],
            "master_count": conn.execute("SELECT COUNT(*) AS count FROM master_students").fetchone()["count"],
            "uploaded_applicants_count": conn.execute("SELECT COUNT(*) AS count FROM uploaded_applicants").fetchone()["count"],
        }
        counts["truly_unplaced_count"] = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM master_students m
            LEFT JOIN placed_students p ON p.bt_id = m.bt_id
            WHERE p.bt_id IS NULL
            """
        ).fetchone()["count"]

        return {
            **counts,
            "placed_updated_at": _get_meta(conn, "placed_updated_at"),
            "master_updated_at": _get_meta(conn, "master_updated_at"),
            "applicants_updated_at": _get_meta(conn, "applicants_updated_at"),
            "placed_source_filename": _get_meta(conn, "placed_source_filename", ""),
            "master_source_filename": _get_meta(conn, "master_source_filename", ""),
            "applicants_source_filename": _get_meta(conn, "applicants_source_filename", ""),
            "applicants_columns": _get_meta(conn, "applicants_columns", []),
        }
