"""
LLM reasoning layer.

Per the engineering principle in the product spec: the LLM is NEVER asked to
invent measurements or facts. It only receives already-computed,
deterministic results (from dfm_checker.py, bom_analyzer.py,
manufacturer_service.py) and is asked to explain them in plain English.

If no LLM_API_KEY is configured, a deterministic template-based summary is
used instead so the whole product still works out of the box.
"""
from __future__ import annotations

import os

LLM_API_KEY = os.getenv("LLM_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL", "claude-sonnet-4-5")

_client = None
if LLM_API_KEY:
    try:
        import anthropic
        _client = anthropic.Anthropic(api_key=LLM_API_KEY)
    except ImportError:
        _client = None


def _complete(system: str, prompt: str, max_tokens: int = 300) -> str | None:
    if not _client:
        return None
    try:
        resp = _client.messages.create(
            model=LLM_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(b.text for b in resp.content if hasattr(b, "text")).strip()
    except Exception:
        return None


def summarize_dfm(dfm_result) -> str:
    system = (
        "You are a PCB manufacturing engineer explaining deterministic DFM "
        "check results to a hardware designer. Only use the facts given to "
        "you. Never invent measurements. Be concise (2-4 sentences)."
    )
    facts = (
        f"Status: {dfm_result.status}\n"
        f"Checks: {dfm_result.passed_checks}/{dfm_result.total_checks} passed\n"
        f"Issues: {[i.message for i in dfm_result.issues]}"
    )
    result = _complete(system, f"Explain these DFM results:\n{facts}")
    if result:
        return result

    if not dfm_result.issues:
        return (
            f"All {dfm_result.total_checks} DFM checks passed. The board is fully "
            "manufacturable with no design rule violations detected."
        )
    high = [i for i in dfm_result.issues if i.severity == "HIGH"]
    if high:
        return (
            f"{len(dfm_result.issues)} DFM issue(s) detected, including {len(high)} high-severity "
            f"issue(s). {high[0].message} Review and resolve before proceeding to manufacturing."
        )
    return (
        f"{len(dfm_result.issues)} minor DFM issue(s) detected out of {dfm_result.total_checks} checks. "
        f"{dfm_result.issues[0].message} These are warnings and manufacturing can typically proceed."
    )


def summarize_bom(bom_result) -> str:
    system = (
        "You are a supply-chain engineer summarizing a BOM analysis. Only use "
        "given facts. Be concise (2-3 sentences)."
    )
    facts = (
        f"Items: {len(bom_result.items)}, Total cost: ${bom_result.total_cost_usd}, "
        f"Risk items: {bom_result.risk_count}\n"
        f"{[(i.part, i.availability) for i in bom_result.items]}"
    )
    result = _complete(system, f"Summarize this BOM:\n{facts}")
    if result:
        return result

    if bom_result.risk_count == 0:
        return (
            f"All {len(bom_result.items)} components are in stock. Estimated component "
            f"cost is ${bom_result.total_cost_usd} per unit."
        )
    return (
        f"{bom_result.risk_count} of {len(bom_result.items)} components have supply risk "
        f"(low stock or unavailable). Estimated component cost is ${bom_result.total_cost_usd} "
        "per unit; consider substituting flagged parts with the suggested alternatives."
    )


def explain_recommendation(recommendation) -> str:
    system = (
        "You are a manufacturing sourcing agent explaining why you recommend a "
        "particular PCB manufacturer, using only the given scored facts. Be "
        "concise and confident (2-3 sentences)."
    )
    best = recommendation.recommended
    facts = (
        f"Recommended: {best.manufacturer_name}, price ${best.price_usd}, "
        f"lead time {best.lead_time_days} days, score {best.score}/100, reasons: {best.reasons}\n"
        f"Alternatives: {[(q.manufacturer_name, q.price_usd, q.lead_time_days, q.score) for q in recommendation.all_quotes if q != best]}"
    )
    result = _complete(system, f"Explain this manufacturer recommendation:\n{facts}")
    if result:
        return result
    return recommendation.explanation
