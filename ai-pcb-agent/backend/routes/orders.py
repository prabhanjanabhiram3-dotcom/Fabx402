from __future__ import annotations
from fastapi import APIRouter, HTTPException
import db

router = APIRouter(prefix="/api", tags=["orders"])


@router.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = db.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    return order


@router.get("/payments/{payment_id}")
async def get_payment(payment_id: str):
    payment = db.get_payment(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found.")
    return payment
