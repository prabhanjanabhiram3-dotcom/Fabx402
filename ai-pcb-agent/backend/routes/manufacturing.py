"""Manufacturing routes — ANALYSIS AND QUOTING ONLY.

WHAT CHANGED
------------
The x402-protected `POST /api/manufacturing/order` endpoint has been REMOVED.
It returned a hand-rolled 402 for Base Sepolia and settled through a local
facilitator that generated fake transaction hashes.

The real manufacturing payment is now `POST /api/x402/manufacturing-order`
on the Node x402 service, protected by the official @x402/express middleware
and settled on Algorand Testnet via GoPlausible.

This module keeps what FastAPI is genuinely good at: the manufacturer
catalogue, deterministic quoting, and the spend-limit policy check.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from tools import manufacturer_service
from agents import payment_agent
import db

router = APIRouter(prefix="/api", tags=["manufacturing"])


@router.get("/manufacturers")
async def list_manufacturers():
    return [m.model_dump() for m in manufacturer_service.get_manufacturers()]


@router.post("/manufacturers/compare")
async def compare_manufacturers(project_id: str):
    project = db.PROJECTS.get(project_id)
    if not project or "recommendation" not in project:
        raise HTTPException(status_code=404, detail="Run PCB analysis first.")
    return project["recommendation"]


@router.post("/manufacturing/quote")
async def get_quote(project_id: str, manufacturer_id: str, quantity: int = 5):
    project = db.PROJECTS.get(project_id)
    if not project or "recommendation" not in project:
        raise HTTPException(status_code=404, detail="Run PCB analysis first.")

    quotes = project["recommendation"]["all_quotes"]
    quote = next((q for q in quotes if q["manufacturer_id"] == manufacturer_id), None)
    if not quote:
        raise HTTPException(status_code=404, detail="Manufacturer quote not found.")

    # Manufacturer prices are quoted for a standard 5-board prototype batch
    # (small-batch PCB fab pricing is roughly flat, not linear per unit), so
    # scale relative to that reference batch rather than multiplying the
    # per-unit price directly by quantity.
    total = round(quote["price_usd"] * quantity / 5, 2)
    return {**quote, "quantity": quantity, "total_price": total}


@router.post("/manufacturing/validate-order")
async def validate_order(project_id: str, manufacturer_id: str, quantity: int, total_price: float):
    """Pre-flight policy check, run BEFORE the user is shown the payment step.

    This is not a payment. It confirms the project and manufacturer exist and
    that the order total sits within the autonomous spending limit, so the UI
    can block an over-limit order before any wallet prompt appears.
    """
    project = db.PROJECTS.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="PCB project not found.")

    mfr = manufacturer_service.get_manufacturer(manufacturer_id)
    if not mfr:
        raise HTTPException(status_code=404, detail="Manufacturer not found.")

    try:
        payment_agent.check_spend_limit(total_price)
    except payment_agent.SpendLimitExceeded as e:
        return JSONResponse(status_code=403, content={
            "error": "SPEND_LIMIT_EXCEEDED",
            "message": str(e),
            "limit_usd": payment_agent.MAX_AUTONOMOUS_SPEND_USD,
        })

    return {
        "ok": True,
        "manufacturer": mfr.name,
        "quantity": quantity,
        "total_price": total_price,
        "estimated_delivery_days": mfr.lead_time_days,
        "note": "Policy check only. Payment is settled by the x402 service on Algorand.",
    }
