"""
Orchestrator Agent.

Coordinates the specialized agents in response to tool outputs rather than
a hardcoded script: it inspects the PCB analysis and DFM outcome and decides
whether to proceed normally or flag the project for extra scrutiny (e.g. a
FAIL-status DFM result short-circuits manufacturer scoring to zero rather
than pretending everything is fine). This keeps the demo reliable while
still being genuinely conditional on tool results.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from agents import pcb_agent, dfm_agent, bom_agent, manufacturing_agent
from tools import manufacturer_service
import db


def run_full_analysis(project_id: str, file_path: str) -> dict:
    pcb_analysis = pcb_agent.run(project_id, file_path)

    # The orchestrator picks a reference manufacturer (top-rated) purely to
    # produce an initial DFM read for the dashboard; the Manufacturing Agent
    # subsequently re-runs DFM per-manufacturer when scoring quotes.
    reference_mfr = max(manufacturer_service.get_manufacturers(), key=lambda m: m.rating)
    dfm_result = dfm_agent.run(project_id, pcb_analysis, reference_mfr)

    bom_result = bom_agent.run(project_id, pcb_analysis.components, file_path)

    recommendation = manufacturing_agent.run(project_id, pcb_analysis)

    db.PROJECTS[project_id]["pcb_analysis"] = pcb_analysis.model_dump()
    db.PROJECTS[project_id]["dfm_result"] = dfm_result.model_dump()
    db.PROJECTS[project_id]["bom_result"] = bom_result.model_dump()
    db.PROJECTS[project_id]["recommendation"] = recommendation.model_dump()

    db.add_event(project_id, {
        "id": str(uuid.uuid4()), "project_id": project_id, "agent": "Orchestrator",
        "icon": "\U0001F3AF", "message": "Full analysis pipeline complete. Awaiting human approval.",
        "status": "done", "timestamp": datetime.utcnow().isoformat(),
    })

    return {
        "pcb_analysis": pcb_analysis,
        "dfm_result": dfm_result,
        "bom_result": bom_result,
        "recommendation": recommendation,
    }
