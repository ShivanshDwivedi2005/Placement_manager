import io
import re
from typing import Dict, List, Optional, Tuple

import pandas as pd

EXPECTED_COLUMNS = {
    "bt_id": ["bt-id", "bt id", "btid", "bt_id", "student id", "studentid", "id", "roll no", "rollno", "roll number", "rollnumber"],
    "name": ["name", "student name", "full name"],
    "cgpa": ["cgpa", "gpa", "cpi"],
    "company": ["company", "placed company", "organization"],
    "job_profile": ["job profile", "profile", "role", "designation", "position"],
    "duration": ["duration", "internship duration", "tenure", "period"],
    "stipend": ["stipend", "ctc", "salary", "package"],
}


def read_tabular_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    filename = filename.lower()
    if filename.endswith(".csv"):
        return pd.read_csv(io.BytesIO(file_bytes), dtype=str)
    if filename.endswith((".xlsx", ".xls")):
        return pd.read_excel(io.BytesIO(file_bytes), dtype=str)
    raise ValueError(f"Unsupported file type: {filename}")


def _prepare_dataframe(file_bytes: bytes, filename: str) -> pd.DataFrame:
    try:
        df = read_tabular_file(file_bytes, filename)
    except Exception as exc:
        raise ValueError(f"Failed to parse file: {exc}") from exc

    df = df.dropna(how="all")
    df.columns = [str(column).strip() for column in df.columns]
    return df


def _canonicalize_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value).strip().lower())


def _find_column(columns: List[str], variants: List[str]):
    lower_map = {_canonicalize_header(column): column for column in columns}
    for variant in variants:
        canonical_variant = _canonicalize_header(variant)
        if canonical_variant in lower_map:
            return lower_map[canonical_variant]
    return None


def _normalize_bt_ids(df: pd.DataFrame, warnings: List[str]) -> pd.DataFrame:
    bt_id_column = _find_column(list(df.columns), EXPECTED_COLUMNS["bt_id"])
    if not bt_id_column:
        warnings.append("BT-ID column not found")
        return df

    if bt_id_column != "bt_id":
        df = df.rename(columns={bt_id_column: "bt_id"})

    df["bt_id"] = df["bt_id"].fillna("").astype(str).str.strip().str.upper()
    df = df[df["bt_id"] != ""]
    return df


def _remove_duplicate_bt_ids(df: pd.DataFrame, warnings: List[str]) -> pd.DataFrame:
    if "bt_id" not in df.columns:
        return df
    before = len(df)
    df = df.drop_duplicates(subset=["bt_id"], keep="first")
    removed = before - len(df)
    if removed > 0:
        warnings.append(f"Removed {removed} duplicate BT-ID(s)")
    return df


def _finalize_records(df: pd.DataFrame) -> List[Dict]:
    return df.where(pd.notna(df), None).to_dict(orient="records")


def _get_semantic_value(record: Dict, semantic_key: str):
    column = _find_column(list(record.keys()), EXPECTED_COLUMNS.get(semantic_key, []))
    if not column:
        return None
    return record.get(column)


def _parse_float(value) -> Optional[float]:
    if value in [None, ""]:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def applicants_have_semantic_column(applicants: List[Dict], semantic_key: str) -> bool:
    return any(_get_semantic_value(applicant, semantic_key) not in [None, ""] for applicant in applicants)


def _matches_search(applicant: Dict, search: Optional[str]) -> bool:
    if not search:
        return True

    needle = str(search).strip().lower()
    if not needle:
        return True

    values = [applicant.get("bt_id"), _get_semantic_value(applicant, "name")]
    for value in values:
        if value and needle in str(value).strip().lower():
            return True
    return False


def _matches_cgpa(applicant: Dict, cgpa_min: Optional[float]) -> bool:
    if cgpa_min is None:
        return True

    cgpa_value = _parse_float(_get_semantic_value(applicant, "cgpa"))
    if cgpa_value is None:
        return False
    return cgpa_value >= cgpa_min


def parse_applicant_file(file_bytes: bytes, filename: str) -> Tuple[List[Dict], List[str], List[str]]:
    warnings: List[str] = []
    df = _prepare_dataframe(file_bytes, filename)
    df = _normalize_bt_ids(df, warnings)
    df = _remove_duplicate_bt_ids(df, warnings)

    if "bt_id" not in df.columns:
        raise ValueError("BT-ID column is required in the applicants file")

    ordered_columns = list(df.columns)
    if "bt_id" in ordered_columns:
        ordered_columns = ["bt_id", *[column for column in ordered_columns if column != "bt_id"]]
        df = df[ordered_columns]

    return _finalize_records(df), warnings, ordered_columns


def parse_master_students_file(file_bytes: bytes, filename: str) -> Tuple[List[Dict], List[str]]:
    warnings: List[str] = []
    df = _prepare_dataframe(file_bytes, filename)
    bt_id_column = _find_column(list(df.columns), EXPECTED_COLUMNS["bt_id"])
    name_column = _find_column(list(df.columns), EXPECTED_COLUMNS["name"])
    cgpa_column = _find_column(list(df.columns), EXPECTED_COLUMNS["cgpa"])

    if not bt_id_column or not name_column:
        raise ValueError("Master students file must contain BT-ID and Name columns")

    rename_map = {bt_id_column: "bt_id", name_column: "name"}
    if cgpa_column:
        rename_map[cgpa_column] = "cgpa"
    df = df.rename(columns=rename_map)
    df = _normalize_bt_ids(df, warnings)
    df = _remove_duplicate_bt_ids(df, warnings)

    selected_columns = ["bt_id", "name"]
    if "cgpa" in df.columns:
        df["cgpa"] = pd.to_numeric(df["cgpa"], errors="coerce")
        selected_columns.append("cgpa")

    return _finalize_records(df[selected_columns]), warnings


def parse_placed_students_file(file_bytes: bytes, filename: str) -> Tuple[List[Dict], List[str]]:
    warnings: List[str] = []
    df = _prepare_dataframe(file_bytes, filename)
    bt_id_column = _find_column(list(df.columns), EXPECTED_COLUMNS["bt_id"])
    name_column = _find_column(list(df.columns), EXPECTED_COLUMNS["name"])

    if not bt_id_column or not name_column:
        raise ValueError("Placed students file must contain BT-ID and Name columns")

    rename_map = {bt_id_column: "bt_id", name_column: "name"}
    for key in ["company", "job_profile", "duration", "stipend"]:
        column = _find_column(list(df.columns), EXPECTED_COLUMNS[key])
        if column:
            rename_map[column] = key

    df = df.rename(columns=rename_map)
    df = _normalize_bt_ids(df, warnings)
    df = _remove_duplicate_bt_ids(df, warnings)

    for optional_col in ["company", "job_profile", "duration", "stipend"]:
        if optional_col not in df.columns:
            df[optional_col] = None

    return _finalize_records(df[["bt_id", "name", "company", "job_profile", "duration", "stipend"]]), warnings


def filter_applicants(
    applicants: List[Dict],
    placed_ids: set,
    remove_placed: bool = True,
    search: Optional[str] = None,
    cgpa_min: Optional[float] = None,
) -> Tuple[List[Dict], List[Dict], List[Dict]]:
    placed_in_upload = []
    unplaced = []

    for applicant in applicants:
        bt_id = str(applicant.get("bt_id", "")).strip().upper()
        if bt_id in placed_ids:
            placed_in_upload.append(applicant)
        else:
            unplaced.append(applicant)

    base_rows = unplaced if remove_placed else applicants
    filtered = [
        applicant
        for applicant in base_rows
        if _matches_search(applicant, search) and _matches_cgpa(applicant, cgpa_min)
    ]

    return filtered, placed_in_upload, unplaced
