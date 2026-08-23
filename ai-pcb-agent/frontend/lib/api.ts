/**
 * FastAPI client — ANALYSIS ONLY.
 *
 * The Base Sepolia x402 code that used to live here (`buildDemoPaymentHeader`,
 * `createOrderWithX402`) has been REMOVED. It fabricated EIP-3009 payloads with
 * `0xDEMO_SIGNATURE_…` against a local facilitator that minted fake `0x…`
 * transaction hashes — exactly what the final build must not do.
 *
 * All payments now go through the real Algorand x402 service via lib/x402.ts.
 * FastAPI keeps doing what it is genuinely good at: deterministic PCB parsing,
 * DFM rules, BOM analysis, and manufacturer ranking. It handles no money.
 */

import type { AnalysisBundle, AgentEvent } from "@/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = "Request failed. Please try again.";
    try {
      const body = await res.json();
      detail = body.detail || body.message || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function uploadPCB(file: File): Promise<{ id: string; filename: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pcb/upload`, { method: "POST", body: form });
  return handle(res);
}

export async function analyzePCB(projectId: string): Promise<AnalysisBundle> {
  const res = await fetch(`${API_BASE}/api/pcb/${projectId}/analyze`, { method: "POST" });
  return handle(res);
}

export async function getEvents(projectId: string): Promise<AgentEvent[]> {
  const res = await fetch(`${API_BASE}/api/agent/events/${projectId}`);
  return handle(res);
}
