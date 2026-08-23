from __future__ import annotations

import shutil
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException

from agents import orchestrator
import db

router = APIRouter(prefix="/api/pcb", tags=["pcb"])

UPLOAD_DIR = Path(__file__).parent.parent / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload")
async def upload_pcb(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    project_id = f"PCB-{uuid.uuid4().hex[:6].upper()}"
    dest = UPLOAD_DIR / f"{project_id}_{file.filename}"

    try:
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception:
        raise HTTPException(status_code=500, detail="Could not save uploaded file. Please try again.")

    db.PROJECTS[project_id] = {
        "id": project_id,
        "filename": file.filename,
        "uploaded_at": datetime.utcnow().isoformat(),
        "raw_path": str(dest),
    }
    db.EVENTS[project_id] = []

    return {"id": project_id, "filename": file.filename}


@router.get("/{project_id}")
async def get_pcb(project_id: str):
    project = db.PROJECTS.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="PCB project not found.")
    return project


@router.post("/{project_id}/analyze")
async def analyze_pcb(project_id: str):
    project = db.PROJECTS.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="PCB project not found.")

    try:
        result = orchestrator.run_full_analysis(project_id, project["raw_path"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")

    return {
        "pcb_analysis": result["pcb_analysis"],
        "dfm_result": result["dfm_result"],
        "bom_result": result["bom_result"],
        "recommendation": result["recommendation"],
    }


@router.post("/{project_id}/dfm")
async def get_dfm(project_id: str):
    project = db.PROJECTS.get(project_id)
    if not project or "dfm_result" not in project:
        raise HTTPException(status_code=404, detail="DFM result not available. Run /analyze first.")
    return project["dfm_result"]


@router.post("/{project_id}/bom")
async def get_bom(project_id: str):
    project = db.PROJECTS.get(project_id)
    if not project or "bom_result" not in project:
        raise HTTPException(status_code=404, detail="BOM result not available. Run /analyze first.")
    return project["bom_result"]
