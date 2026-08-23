"""
Core Pydantic models shared across the AI PCB Manufacturing Agent backend.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid


def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


# ---------------------------------------------------------------------------
# PCB
# ---------------------------------------------------------------------------

class PCBAnalysis(BaseModel):
    board_width_mm: float
    board_height_mm: float
    area_mm2: float
    layers: int
    components: int
    footprints: int
    pads: int
    vias: int
    tracks: int
    zones: int
    min_trace_width_mm: float
    min_clearance_mm: float
    min_drill_diameter_mm: float
    board_edge_clearance_mm: float
    source: str = Field(description="'pcbnew' | 'fallback_parser' | 'demo_fixture'")


class PCBProject(BaseModel):
    id: str
    filename: str
    uploaded_at: datetime
    analysis: Optional[PCBAnalysis] = None
    raw_path: Optional[str] = None


# ---------------------------------------------------------------------------
# DFM
# ---------------------------------------------------------------------------

class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class DFMStatus(str, Enum):
    PASS = "PASS"
    WARNING = "WARNING"
    FAIL = "FAIL"


class DFMIssue(BaseModel):
    type: str
    severity: Severity
    actual: float
    required: float
    message: str


class DFMCheck(BaseModel):
    name: str
    passed: bool


class DFMResult(BaseModel):
    status: DFMStatus
    total_checks: int
    passed_checks: int
    issues: List[DFMIssue]
    checks: List[DFMCheck]
    ai_summary: Optional[str] = None


# ---------------------------------------------------------------------------
# BOM
# ---------------------------------------------------------------------------

class Availability(str, Enum):
    AVAILABLE = "AVAILABLE"
    LOW_STOCK = "LOW_STOCK"
    UNAVAILABLE = "UNAVAILABLE"


class BOMItem(BaseModel):
    part: str
    description: str
    quantity: int
    unit_cost_usd: float
    availability: Availability
    alternatives: List[str] = []


class BOMResult(BaseModel):
    items: List[BOMItem]
    total_cost_usd: float
    risk_count: int
    ai_summary: Optional[str] = None


# ---------------------------------------------------------------------------
# Manufacturing
# ---------------------------------------------------------------------------

class Manufacturer(BaseModel):
    id: str
    name: str
    base_price_usd: float
    lead_time_days: int
    max_layers: int
    min_trace_width_mm: float
    min_clearance_mm: float
    min_drill_diameter_mm: float
    rating: float


class ManufacturingQuote(BaseModel):
    manufacturer_id: str
    manufacturer_name: str
    price_usd: float
    lead_time_days: int
    dfm_compatible: bool
    layer_compatible: bool
    score: float
    reasons: List[str]


class ManufacturingRecommendation(BaseModel):
    recommended: ManufacturingQuote
    all_quotes: List[ManufacturingQuote]
    explanation: str


# ---------------------------------------------------------------------------
# Orders / Payments
# ---------------------------------------------------------------------------

class OrderStatus(str, Enum):
    PENDING_PAYMENT = "PENDING_PAYMENT"
    PAYMENT_REQUIRED = "PAYMENT_REQUIRED"
    ORDER_CONFIRMED = "ORDER_CONFIRMED"
    MANUFACTURING = "MANUFACTURING"
    FAILED = "FAILED"


class PaymentStatus(str, Enum):
    NONE = "NONE"
    REQUIRED = "REQUIRED"
    SIGNED = "SIGNED"
    VERIFIED = "VERIFIED"
    SETTLED = "SETTLED"
    FAILED = "FAILED"


class OrderCreateRequest(BaseModel):
    pcb_id: str
    manufacturer_id: str
    quantity: int = Field(gt=0, le=1000)
    total_price: float


class Payment(BaseModel):
    id: str
    order_id: str
    amount_usd: float
    network: str
    asset: str
    payer_address: Optional[str] = None
    receiver_address: Optional[str] = None
    tx_hash: Optional[str] = None
    status: PaymentStatus
    created_at: datetime
    settled_at: Optional[datetime] = None


class Order(BaseModel):
    id: str
    pcb_id: str
    manufacturer_id: str
    manufacturer_name: str
    quantity: int
    total_price: float
    estimated_delivery_days: int
    status: OrderStatus
    payment_id: Optional[str] = None
    created_at: datetime


class AgentEvent(BaseModel):
    id: str
    project_id: str
    agent: str
    icon: str
    message: str
    status: str  # "running" | "done" | "error"
    timestamp: datetime
