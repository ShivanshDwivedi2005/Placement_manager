import io
import logging
import re
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook

from auth.jwt_handler import get_current_admin
from services.applicant_service import applicants_have_semantic_column, filter_applicants, parse_applicant_file
from services.database_service import (
    get_download_history_entry,
    get_placed_students,
    get_recent_download_history,
    get_storage_status,
    get_uploaded_applicant_columns,
    get_uploaded_applicants,
    normalize_branch,
    save_download_history,
    store_uploaded_applicants,
)
from services.email_service import send_download_notification, send_filter_notification

router = APIRouter(prefix="/applicants", tags=["applicants"])
logger = logging.getLogger(__name__)

_last_upload_warnings = []


def _require_uploaded_applicants():
    applicants = get_uploaded_applicants()
    if not applicants:
        raise HTTPException(status_code=400, detail="Upload an applicant file first")
    return applicants


def _normalize_search(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _build_filters_used(search: Optional[str], cgpa_min: Optional[float], branch: Optional[str], remove_placed: bool):
    return {
        "Search": search or "Not applied",
        "CGPA Minimum": cgpa_min if cgpa_min is not None else "Not applied",
        "Branch": normalize_branch(branch) if branch else "Not applied",
        "Remove Placed Students": "Yes" if remove_placed else "No",
        "Duplicate BT-ID Removal": "Automatic during upload",
    }


def _build_download_filename(search: Optional[str], cgpa_min: Optional[float], branch: Optional[str], remove_placed: bool) -> str:
    parts = ["filtered_applicants"]
    if search:
        safe_search = re.sub(r"[^A-Za-z0-9_-]+", "_", search.strip())[:30].strip("_")
        if safe_search:
            parts.append(f"search_{safe_search}")
    if cgpa_min is not None:
        parts.append(f"cgpa_{str(cgpa_min).replace('.', '_')}")
    if branch:
        parts.append(f"branch_{normalize_branch(branch)}")
    parts.append("placed_removed" if remove_placed else "placed_kept")
    return f"{'_'.join(parts)}.xlsx"


def _looks_like_url(value) -> bool:
    return isinstance(value, str) and re.match(r"^https?://", value.strip(), re.IGNORECASE) is not None


@router.post("/upload")
async def upload_applicants(file: UploadFile = File(...), _=Depends(get_current_admin)):
    global _last_upload_warnings

    content = await file.read()
    applicants, warnings, columns = parse_applicant_file(content, file.filename or "upload.xlsx")

    placed = get_placed_students()
    placed_ids = {student["BT-ID"] for student in placed}
    already_placed = [row for row in applicants if str(row.get("bt_id", "")).upper() in placed_ids]

    if already_placed:
        warnings.append(f"{len(already_placed)} uploaded student(s) are already in the placed list")

    stored_count = store_uploaded_applicants(applicants, source_filename=file.filename, columns=columns)
    _last_upload_warnings = warnings

    return {
        "success": True,
        "total": stored_count,
        "warnings": warnings,
        "already_placed_count": len(already_placed),
        "filename": file.filename,
        "columns": columns,
        "database_status": get_storage_status(),
    }


@router.get("/filter")
async def get_filtered_applicants(
    background_tasks: BackgroundTasks,
    search: Optional[str] = Query(None),
    cgpa_min: Optional[float] = Query(None, ge=0),
    branch: Optional[str] = Query(None),
    remove_placed: bool = Query(True),
    notify: bool = Query(False),
    _=Depends(get_current_admin),
):
    applicants = _require_uploaded_applicants()
    placed_ids = {student["BT-ID"] for student in get_placed_students()}
    normalized_search = _normalize_search(search)

    filtered, placed_in_upload, all_unplaced = filter_applicants(
        applicants,
        placed_ids,
        remove_placed=remove_placed,
        search=normalized_search,
        cgpa_min=cgpa_min,
        branch=branch,
    )

    response_warnings = list(_last_upload_warnings)
    if cgpa_min is not None and not applicants_have_semantic_column(applicants, "cgpa"):
        response_warnings.append("CGPA filter was applied, but no CGPA column was detected in the uploaded file")

    filters_used = _build_filters_used(normalized_search, cgpa_min, branch, remove_placed)

    if notify:
        background_tasks.add_task(
            send_filter_notification,
            total_uploaded=len(applicants),
            filtered_count=len(filtered),
            already_placed_count=len(placed_in_upload),
            filters_used=filters_used,
        )

    return {
        "filtered": filtered,
        "columns": get_uploaded_applicant_columns(),
        "total_uploaded": len(applicants),
        "unplaced_count": len(all_unplaced),
        "filtered_count": len(filtered),
        "placed_in_upload_count": len(placed_in_upload),
        "warnings": response_warnings,
        "filters_applied": filters_used,
        "database_status": get_storage_status(),
    }


@router.get("/download")
async def download_filtered_csv(
    background_tasks: BackgroundTasks,
    search: Optional[str] = Query(None),
    cgpa_min: Optional[float] = Query(None, ge=0),
    branch: Optional[str] = Query(None),
    remove_placed: bool = Query(True),
    _=Depends(get_current_admin),
):
    applicants = _require_uploaded_applicants()
    placed_ids = {student["BT-ID"] for student in get_placed_students()}
    filtered, _, _ = filter_applicants(
        applicants,
        placed_ids,
        remove_placed=remove_placed,
        search=_normalize_search(search),
        cgpa_min=cgpa_min,
        branch=branch,
    )

    columns = get_uploaded_applicant_columns() or (list(filtered[0].keys()) if filtered else ["bt_id"])
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Filtered Applicants"
    worksheet.append(columns)

    for cell in worksheet[1]:
        cell.style = "Headline 1"

    for row in filtered:
        worksheet.append([row.get(key) for key in columns])

    for row in worksheet.iter_rows(min_row=2):
        for cell in row:
            value = cell.value
            if _looks_like_url(value):
                cell.hyperlink = str(value).strip()
                cell.style = "Hyperlink"

    workbook_bytes = io.BytesIO()
    workbook.save(workbook_bytes)
    workbook_bytes.seek(0)
    file_bytes = workbook_bytes.getvalue()
    normalized_search = _normalize_search(search)
    filters_used = _build_filters_used(normalized_search, cgpa_min, branch, remove_placed)
    filename = _build_download_filename(normalized_search, cgpa_min, branch, remove_placed)
    save_download_history(filename=filename, filters_used=filters_used, columns=columns, rows=filtered)
    background_tasks.add_task(send_download_notification, len(filtered), file_bytes, filename)

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/downloads/recent")
async def get_recent_downloads(_=Depends(get_current_admin)):
    return {"downloads": get_recent_download_history()}


@router.get("/downloads/recent/{entry_id}")
async def get_recent_download_detail(entry_id: int, _=Depends(get_current_admin)):
    entry = get_download_history_entry(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Saved CSV history entry not found")
    return entry
