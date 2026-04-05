from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from auth.jwt_handler import get_current_admin
from services.applicant_service import parse_placed_students_file
from services.database_service import (
    add_placed_student,
    bulk_add_placed_students,
    bulk_remove_placed_students,
    get_placed_students,
    get_storage_status,
    remove_placed_student,
    replace_placed_students,
)

router = APIRouter(prefix="/placed", tags=["placed"])


class PlacedStudent(BaseModel):
    bt_id: str
    name: str
    company: Optional[str] = ""
    job_profile: Optional[str] = ""
    duration: Optional[str] = ""
    stipend: Optional[str] = ""


class BulkPasteRow(BaseModel):
    bt_id: str
    name: str
    company: Optional[str] = ""
    job_profile: Optional[str] = ""
    duration: Optional[str] = ""
    stipend: Optional[str] = ""


@router.get("/")
def list_placed(_=Depends(get_current_admin)):
    status = get_storage_status()
    return {
        "students": get_placed_students(),
        "count": status["placed_count"],
        "last_sync": status["placed_updated_at"],
        "source_filename": status["placed_source_filename"],
    }


@router.post("/upload")
async def upload_placed_file(file: UploadFile = File(...), _=Depends(get_current_admin)):
    content = await file.read()
    students, warnings = parse_placed_students_file(content, file.filename or "placed.xlsx")
    count = replace_placed_students(students, source_filename=file.filename)
    return {
        "success": True,
        "count": count,
        "warnings": warnings,
        "filename": file.filename,
        "message": "Placed students file imported into SQLite",
    }


@router.post("/add")
def add_student(student: PlacedStudent, _=Depends(get_current_admin)):
    add_placed_student(student.model_dump())
    return {"success": True, "message": f"{student.bt_id.strip().upper()} saved to placed students"}


@router.delete("/{bt_id}")
def delete_student(bt_id: str, _=Depends(get_current_admin)):
    removed = remove_placed_student(bt_id)
    if not removed:
        raise HTTPException(status_code=404, detail=f"BT-ID {bt_id} not found in placed students")
    return {"success": True, "message": f"{bt_id.strip().upper()} removed from placed students"}


@router.post("/bulk")
def bulk_add(rows: List[BulkPasteRow], _=Depends(get_current_admin)):
    count = bulk_add_placed_students([row.model_dump() for row in rows])
    return {"success": True, "added": count}


@router.post("/bulk-remove")
def bulk_remove(rows: List[BulkPasteRow], _=Depends(get_current_admin)):
    result = bulk_remove_placed_students([row.bt_id for row in rows])
    return {"success": True, **result}


@router.post("/bulk-paste")
def bulk_paste(payload: dict, _=Depends(get_current_admin)):
    raw_text = payload.get("text", "")
    rows = []
    for line in raw_text.strip().splitlines():
        parts = [part.strip() for part in line.split("\t")]
        if len(parts) >= 2:
            rows.append(
                {
                    "bt_id": parts[0],
                    "name": parts[1],
                    "company": parts[2] if len(parts) > 2 else "",
                    "job_profile": parts[3] if len(parts) > 3 else "",
                    "duration": parts[4] if len(parts) > 4 else "",
                    "stipend": parts[5] if len(parts) > 5 else "",
                }
            )

    if not rows:
        raise HTTPException(status_code=400, detail="No valid rows parsed from pasted text")

    count = bulk_add_placed_students(rows)
    return {"success": True, "added": count, "rows_parsed": len(rows)}
