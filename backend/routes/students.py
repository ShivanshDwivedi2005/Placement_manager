from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile

from auth.jwt_handler import get_current_admin
from services.applicant_service import parse_master_students_file
from services.database_service import (
    get_master_students,
    get_storage_status,
    get_truly_unplaced_students,
    replace_master_students,
)

router = APIRouter(prefix="/students", tags=["students"])


@router.post("/master/upload")
async def upload_master_students(file: UploadFile = File(...), _=Depends(get_current_admin)):
    content = await file.read()
    students, warnings = parse_master_students_file(content, file.filename or "master.xlsx")
    count = replace_master_students(students, source_filename=file.filename)
    return {
        "success": True,
        "count": count,
        "warnings": warnings,
        "filename": file.filename,
        "message": "Master students file imported into PostgreSQL",
    }


@router.get("/unplaced")
def truly_unplaced(
    search: Optional[str] = Query(None),
    _=Depends(get_current_admin),
):
    students = get_truly_unplaced_students()

    if search:
        query = search.lower()
        students = [
            student
            for student in students
            if query in str(student.get("Name", "")).lower() or query in str(student.get("BT-ID", "")).lower()
        ]

    status = get_storage_status()
    return {
        "students": students,
        "count": len(students),
        "last_sync": status["master_updated_at"] or status["placed_updated_at"],
    }


@router.get("/master")
def master_list(_=Depends(get_current_admin)):
    students = get_master_students()
    status = get_storage_status()
    return {
        "students": students,
        "count": len(students),
        "last_sync": status["master_updated_at"],
        "source_filename": status["master_source_filename"],
    }


@router.get("/status")
def storage_status(_=Depends(get_current_admin)):
    return get_storage_status()
