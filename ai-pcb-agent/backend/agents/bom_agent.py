"""BOM Agent: wraps component/BOM analysis and adds AI explanation."""
from tools.bom_analyzer import analyze_bom
from tools import llm_service
from models import BOMResult
import db
from datetime import datetime
import uuid


def run(project_id: str, component_count: int, file_path: str | None = None) -> BOMResult:
    db.add_event(project_id, {
        "id": str(uuid.uuid4()), "project_id": project_id, "agent": "BOM Agent",
        "icon": "\U0001F4E6", "message": "Checking components...", "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
    })
    # Derive the BOM from the ACTUAL footprints in the uploaded file when
    # available, so different boards produce different BOMs.
    result = analyze_bom(component_count, file_path)
    result.ai_summary = llm_service.summarize_bom(result)
    db.add_event(project_id, {
        "id": str(uuid.uuid4()), "project_id": project_id, "agent": "BOM Agent",
        "icon": "\u2705", "message": "BOM analysis completed", "status": "done",
        "timestamp": datetime.utcnow().isoformat(),
    })
    return result
