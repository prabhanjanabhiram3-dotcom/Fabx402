"""
Mock manufacturing marketplace: quote generation, DFM/layer compatibility
checks, and a deterministic weighted-scoring recommendation engine.
"""
from __future__ import annotations

import json
from pathlib import Path
from models import Manufacturer, ManufacturingQuote, ManufacturingRecommendation, PCBAnalysis, DFMResult, DFMStatus

_DATA_PATH = Path(__file__).parent.parent / "data" / "manufacturers.json"


def get_manufacturers() -> list[Manufacturer]:
    raw = json.loads(_DATA_PATH.read_text())
    return [Manufacturer(**m) for m in raw]


def get_manufacturer(manufacturer_id: str) -> Manufacturer | None:
    for m in get_manufacturers():
        if m.id == manufacturer_id:
            return m
    return None


def _price_for_board(base_price: float, pcb: PCBAnalysis, quantity: int = 5) -> float:
    """Deterministic pricing model: base price scaled by layer count and
    board area relative to a reference 80x50mm 4-layer board, times qty."""
    layer_factor = max(pcb.layers / 4, 0.5)
    area_factor = max(pcb.area_mm2 / 4000, 0.5)
    unit_price = base_price * layer_factor * area_factor
    return round(unit_price, 2)


def get_quotes(pcb: PCBAnalysis, dfm_by_manufacturer: dict[str, DFMResult]) -> list[ManufacturingQuote]:
    """Build one quote per manufacturer, incorporating each manufacturer's
    OWN DFM evaluation of the board (dfm_by_manufacturer keyed by mfr id)."""
    quotes = []
    for mfr in get_manufacturers():
        dfm = dfm_by_manufacturer[mfr.id]
        layer_ok = pcb.layers <= mfr.max_layers
        dfm_ok = dfm.status != DFMStatus.FAIL

        price = _price_for_board(mfr.base_price_usd, pcb)

        score, reasons = _score(mfr, price, dfm, layer_ok)

        quotes.append(ManufacturingQuote(
            manufacturer_id=mfr.id,
            manufacturer_name=mfr.name,
            price_usd=price,
            lead_time_days=mfr.lead_time_days,
            dfm_compatible=dfm_ok,
            layer_compatible=layer_ok,
            score=score,
            reasons=reasons,
        ))
    return quotes


def _score(mfr: Manufacturer, price: float, dfm: DFMResult, layer_ok: bool) -> tuple[float, list[str]]:
    """Weighted score, 0-100.

    WHAT CHANGED: a DFM failure used to return 0.0 immediately. When no
    manufacturer fully passed DFM (common for a demanding board) EVERY option
    scored 0, the ranking became meaningless, and the recommendation text read
    "recommended because it board fails this manufacturer's minimum dfm
    requirements. It scored 0.0/100".

    Per the ranking spec, only manufacturers that genuinely CANNOT build the
    board are eliminated (layer count). A DFM failure is a serious penalty -
    the DFM component drops to 0 - but the option stays comparable on price,
    lead time and rating, so the agent can still surface the closest match and
    say exactly what must be fixed.
    """
    reasons = []

    if not layer_ok:
        return 0.0, [f"cannot manufacture {mfr.max_layers}+ layer boards at the required layer count"]

    all_mfrs = get_manufacturers()
    reference = PCBAnalysis(
        board_width_mm=80, board_height_mm=50, area_mm2=4000, layers=4,
        components=1, footprints=1, pads=1, vias=1, tracks=1, zones=1,
        min_trace_width_mm=0.15, min_clearance_mm=0.12, min_drill_diameter_mm=0.25,
        board_edge_clearance_mm=0.3, source="internal",
    )
    prices = [_price_for_board(m.base_price_usd, reference) for m in all_mfrs]
    lead_times = [m.lead_time_days for m in all_mfrs]

    min_price, max_price = min(prices), max(prices)
    min_lead, max_lead = min(lead_times), max(lead_times)

    price_score = 100 * (1 - (price - min_price) / (max_price - min_price)) if max_price > min_price else 100
    lead_score = 100 * (1 - (mfr.lead_time_days - min_lead) / (max_lead - min_lead)) if max_lead > min_lead else 100
    price_score = max(0.0, min(100.0, price_score))
    lead_score = max(0.0, min(100.0, lead_score))

    if dfm.status == DFMStatus.PASS:
        dfm_score = 100.0
    elif dfm.status == DFMStatus.WARNING:
        dfm_score = 70.0
    else:
        dfm_score = 0.0

    rating_score = (mfr.rating / 5) * 100

    weights = {"price": 0.30, "lead": 0.30, "dfm": 0.25, "rating": 0.15}
    score = (
        price_score * weights["price"]
        + lead_score * weights["lead"]
        + dfm_score * weights["dfm"]
        + rating_score * weights["rating"]
    )

    if dfm.status == DFMStatus.FAIL:
        failed = [c.name for c in dfm.checks if not c.passed]
        reasons.append(
            "does not currently meet " + str(len(failed)) + " DFM requirement"
            + ("s" if len(failed) != 1 else "")
            + " (" + ", ".join(failed[:3]).lower() + ")"
        )
    elif dfm.status == DFMStatus.WARNING:
        reasons.append("is compatible, with minor DFM warnings")
    else:
        reasons.append("is fully compatible with all DFM requirements")

    if lead_score >= 70:
        reasons.append(f"offers a fast {mfr.lead_time_days}-day lead time")
    if price_score >= 70:
        reasons.append(f"is competitively priced at ${price}")
    if mfr.rating >= 4.5:
        reasons.append(f"has a high reliability rating ({mfr.rating}/5)")

    return round(score, 1), reasons


def recommend(quotes: list[ManufacturingQuote]) -> ManufacturingRecommendation:
    """Rank and explain. Never claims a DFM-failing board is simply 'best'."""
    manufacturable = [q for q in quotes if q.layer_compatible]
    ranked = sorted(manufacturable or quotes, key=lambda q: q.score, reverse=True)
    best = ranked[0]

    reason_text = "; ".join(best.reasons) if best.reasons else "offers the best overall balance of cost, lead time and manufacturing compatibility"

    if best.dfm_compatible:
        explanation = (
            f"{best.manufacturer_name} is recommended: it {reason_text}. "
            f"It scored {best.score}/100 across price, lead time, DFM compatibility "
            f"and reliability - the highest of {len(quotes)} evaluated manufacturers."
        )
    else:
        explanation = (
            f"No manufacturer fully satisfies this board's DFM requirements. "
            f"{best.manufacturer_name} is the closest match at {best.score}/100, but it "
            f"{reason_text}. Resolve the flagged DFM issues before ordering, or relax the "
            f"design constraints."
        )

    return ManufacturingRecommendation(recommended=best, all_quotes=ranked, explanation=explanation)
