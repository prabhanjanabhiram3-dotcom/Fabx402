"use client";

/**
 * Real Algorand x402 client flow.
 *
 * REPLACES the previous `buildDemoPaymentHeader` / `createOrderWithX402` in
 * lib/api.ts, which fabricated `0xDEMO_SIGNATURE_…` payloads against Base
 * Sepolia. Nothing here is simulated: the 402 comes from the server, the
 * signature comes from Pera Wallet, and the transaction id comes from
 * GoPlausible's settlement on Algorand Testnet.
 *
 * Pattern lifted from InferPay's working client (InferencePanel.tsx):
 *   Pera signer -> x402Client + ExactAvmScheme(client)
 *   -> wrapFetchWithPayment(fetch) -> decode PAYMENT-RESPONSE header.
 *
 * Why we PROBE first:
 * `wrapFetchWithPayment` swallows the 402 internally (it retries for you), so
 * the UI would never get to show a real "402 Payment Required". We therefore
 * make one deliberate unpaid request to surface the SERVER'S OWN payment
 * requirements (amount, network, asset, payTo), display them, and only then
 * run the paying request. The 402 shown on screen is genuinely from the
 * server — not a hardcoded string.
 */

import { useCallback } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import {
  x402Client,
  wrapFetchWithPayment,
  decodePaymentResponseHeader,
} from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";

export const X402_SERVICE_URL =
  process.env.NEXT_PUBLIC_X402_SERVICE_URL || "http://localhost:3001";

export type X402Stage =
  | "requesting"
  | "required"
  | "awaiting-signature"
  | "settling"
  | "settled"
  | "error";

export interface X402Requirement {
  scheme?: string;
  network?: string;
  payTo?: string;
  asset?: string;
  price?: string;
  maxAmountRequired?: string;
  description?: string;
  [k: string]: unknown;
}

export interface X402Settlement {
  transactionId: string | null;
  network: string | null;
  loraUrl: string | null;
}

export interface X402Outcome<T> extends X402Settlement {
  data: T;
  requirement: X402Requirement | null;
}

/** Mainnet CAIP-2 begins algorand:wGHE2Pwdvd… ; everything else is treated as testnet. */
export function loraUrl(txid: string, network?: string | null): string {
  const net = network && network.includes("wGHE2Pwdvd") ? "mainnet" : "testnet";
  return `https://lora.algokit.io/${net}/transaction/${txid}`;
}

/**
 * Human-readable amount from an x402 requirement.
 *
 * v1 and v2 disagree on the field name, and the AVM scheme reports atomic
 * units. We check every known spelling before giving up, otherwise the panel
 * shows a bare "—" during the demo (which is what happened on the first run).
 */
export function formatRequirementAmount(req: X402Requirement | null): string {
  if (!req) return "—";

  const direct = (req as any).price;
  if (typeof direct === "string" && direct.trim()) return direct;

  const atomicRaw =
    (req as any).maxAmountRequired ??
    (req as any).amountRequired ??
    (req as any).amount ??
    (req as any).maxAmount;

  if (atomicRaw !== undefined && atomicRaw !== null) {
    const atomic = Number(atomicRaw);
    if (Number.isFinite(atomic)) {
      // USDC uses 6 decimals on Algorand.
      const usdc = atomic / 1_000_000;
      return `${usdc.toFixed(usdc < 0.01 ? 6 : 2)} USDC`;
    }
  }
  return "—";
}

export function networkLabel(network?: string | null): string {
  if (!network) return "Algorand";
  if (network.includes("wGHE2Pwdvd")) return "Algorand Mainnet";
  if (network.includes("SGO1GKSzyE7IE")) return "Algorand Testnet";
  return network;
}

/** Decode the x402 v2 PAYMENT-REQUIRED header (base64 JSON, or raw JSON). */
function decodePaymentRequired(headerValue: string | null): any | null {
  if (!headerValue) return null;
  try {
    return JSON.parse(atob(headerValue));
  } catch {
    try {
      return JSON.parse(headerValue);
    } catch {
      return null;
    }
  }
}

/**
 * Deliberate unpaid request to read the server's real payment requirements.
 *
 * x402 v2 returns them in the `PAYMENT-REQUIRED` response HEADER (base64
 * JSON); the body is empty. v1 put them in the body. We read the header
 * first and fall back to the body so both versions work.
 *
 * NOTE: the server must expose this header via CORS (`exposedHeaders`) or
 * the browser will hide it — our x402 service already does.
 *
 * Returns null if the server did NOT ask for payment.
 */
export async function probeX402(
  path: string,
  body: unknown
): Promise<X402Requirement | null> {
  const res = await fetch(`${X402_SERVICE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status !== 402) return null;

  let decoded = decodePaymentRequired(res.headers.get("PAYMENT-REQUIRED"));

  if (!decoded) {
    const payload = await res.json().catch(() => ({} as any));
    if (payload && (payload.accepts || payload.x402Version)) decoded = payload;
  }

  const accepts = decoded?.accepts ?? (decoded?.network ? [decoded] : null);
  const requirement =
    Array.isArray(accepts) && accepts.length ? (accepts[0] as X402Requirement) : null;

  // Surfaced in devtools so an unexpected field name is diagnosable instead of
  // silently rendering an empty amount.
  if (requirement) console.debug("[x402] payment requirement:", requirement);

  return requirement;
}


/**
 * Turn a failed x402 response into something a human can act on.
 *
 * A 402 AFTER the wallet has signed means the facilitator rejected the
 * payment - it is not "payment required" in the usual sense. The reason can
 * arrive in the JSON body, in the PAYMENT-REQUIRED header, or in a
 * PAYMENT-RESPONSE header carrying an errorReason. We check all three and log
 * the raw response so the exact cause is visible in devtools.
 */
async function describeFailure(res: Response): Promise<string> {
  const raw: Record<string, unknown> = { status: res.status };

  let bodyText = "";
  try {
    bodyText = await res.text();
    raw.body = bodyText;
  } catch {
    /* ignore */
  }

  let reason = "";
  try {
    const parsed = bodyText ? JSON.parse(bodyText) : null;
    if (parsed) {
      raw.parsedBody = parsed;
      reason =
        parsed.error ||
        parsed.detail ||
        parsed.reason ||
        parsed.invalidReason ||
        parsed.errorReason ||
        "";
    }
  } catch {
    /* body was not JSON */
  }

  const payResp = res.headers.get("PAYMENT-RESPONSE");
  if (payResp) {
    raw.paymentResponseHeader = payResp;
    try {
      const decoded: any = JSON.parse(atob(payResp));
      raw.paymentResponseDecoded = decoded;
      reason = reason || decoded?.errorReason || decoded?.error || "";
    } catch {
      /* not base64 JSON */
    }
  }

  const payReq = res.headers.get("PAYMENT-REQUIRED");
  if (payReq) {
    raw.paymentRequiredHeader = payReq;
    try {
      raw.paymentRequiredDecoded = JSON.parse(atob(payReq));
    } catch {
      /* not base64 JSON */
    }
  }

  console.error("[x402] payment failed - full response:", raw);

  if (res.status === 402) {
    return reason
      ? `Payment rejected by the facilitator: ${reason}`
      : "Payment was signed but the facilitator rejected it (HTTP 402). " +
          "Check the x402 service terminal for the verify/settle error, and " +
          "confirm the receiving address is opted in to USDC (ASA 10458941).";
  }

  return reason || `Request failed (${res.status}).`;
}

export function usePcbX402() {
  const { activeAccount, signTransactions } = useWallet();

  const payAndCall = useCallback(
    async <T = any,>(
      path: string,
      body: unknown,
      opts?: {
        onStage?: (stage: X402Stage, req?: X402Requirement | null) => void;
        skipProbe?: boolean;
      }
    ): Promise<X402Outcome<T>> => {
      const stage = opts?.onStage ?? (() => {});

      if (!activeAccount) {
        throw new Error("Connect your Pera wallet to authorize this payment.");
      }

      // 1. Show the server's REAL payment requirements.
      let requirement: X402Requirement | null = null;
      if (!opts?.skipProbe) {
        stage("requesting");
        requirement = await probeX402(path, body);
        if (requirement) stage("required", requirement);
      }

      // 2. Build the Pera-backed signer. The key never leaves the wallet.
      const signer = {
        address: activeAccount.address,
        signTransactions: async (txns: Uint8Array[], indexesToSign?: number[]) =>
          signTransactions(txns, indexesToSign),
      };

      const client = new x402Client();
      client.setSpendControls(false);
      client.register("algorand:*", new ExactAvmScheme(signer));

      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      // 3. Pera prompts for approval inside this call, then the server
      //    verifies + settles via GoPlausible before returning 200.
      stage("awaiting-signature", requirement);

      let res: Response;
      try {
        res = await fetchWithPayment(`${X402_SERVICE_URL}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) {
        stage("error", requirement);
        throw new Error(
          e instanceof Error
            ? `Payment was not completed: ${e.message}`
            : "Payment was not completed."
        );
      }

      stage("settling", requirement);

      if (!res.ok) {
        stage("error", requirement);
        throw new Error(await describeFailure(res));
      }

      const data = (await res.json()) as T;

      // 4. Real settlement details from the PAYMENT-RESPONSE header.
      let transactionId: string | null = null;
      let network: string | null = null;
      const header = res.headers.get("PAYMENT-RESPONSE");
      if (header) {
        try {
          const decoded: any =
            typeof decodePaymentResponseHeader === "function"
              ? decodePaymentResponseHeader(header)
              : JSON.parse(atob(header));
          transactionId = decoded?.transaction ?? decoded?.txId ?? null;
          network = decoded?.network ?? null;
        } catch {
          /* leave null — UI states that settlement details were unavailable */
        }
      }

      stage("settled", requirement);

      return {
        data,
        requirement,
        transactionId,
        network,
        loraUrl: transactionId ? loraUrl(transactionId, network) : null,
      };
    },
    [activeAccount, signTransactions]
  );

  return {
    payAndCall,
    connected: Boolean(activeAccount),
    address: activeAccount?.address ?? null,
  };
}


/**
 * AGENT-TO-AGENT payment.
 *
 * Calls the service's autonomous endpoint. The PCB agent pays the inference
 * service from its OWN Algorand wallet - no human signature, no wallet popup.
 * The browser is only asking the agent to act; it is not the payer.
 *
 * This is the difference between human-to-machine commerce (Pera signing) and
 * machine-to-machine commerce (an agent with its own funds). Both produce a
 * real Algorand Testnet transaction.
 */
export interface AgentPayResult {
  mode: string;
  paidBy: string | null;
  paidTo: string;
  amount: string;
  transactionId: string | null;
  network: string | null;
  loraUrl: string | null;
  result: { text?: string; model?: string; [k: string]: unknown };
}

export async function agentManufacturingOrder(body: unknown): Promise<AgentPayResult> {
  const res = await fetch(
  `${X402_SERVICE_URL}/api/agent/manufacturing-order`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as any)?.error || `Autonomous agent payment failed (${res.status}).`
    );
  }
  return data as AgentPayResult;
}

export interface AgentWalletStatus {
  configured: boolean;
  address: string | null;
  network: string;
  maxAutonomousPaymentUsd: number;
}

export async function getAgentWallet(): Promise<AgentWalletStatus | null> {
  try {
    const res = await fetch(`${X402_SERVICE_URL}/api/agent/wallet`);
    if (!res.ok) return null;
    return (await res.json()) as AgentWalletStatus;
  } catch {
    return null;
  }
}
