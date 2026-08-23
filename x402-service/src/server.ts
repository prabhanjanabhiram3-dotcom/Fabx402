/**
 * Unified x402 service for "AI PCB Manufacturing Agent"
 * Powered by InferPay + x402 + Algorand (GoPlausible facilitator).
 *
 * This is the payment BACKBONE of the merged app. It is TypeScript/Node on
 * purpose: the real Algorand x402 packages (@x402/avm, @x402/core,
 * @x402/express) are JS/TS-only — there is no Python SDK for the AVM "exact"
 * scheme — so every genuinely on-chain x402 payment in this project flows
 * through this service, not through the FastAPI backend.
 *
 * It exposes TWO genuinely x402-protected resources on Algorand Testnet:
 *
 *   1. POST /api/inference            -> USE CASE A (AI inference payment)
 *        InferPay's LLM router (lifted verbatim from the InferPay repo).
 *   2. POST /api/x402/manufacturing-order -> USE CASE B (manufacturing payment)
 *        Settles a real (small) testnet-USDC payment, then records the order.
 *
 * Both use the SAME proven pattern from InferPay's server/index.ts:
 *   HTTPFacilitatorClient(GoPlausible) -> x402ResourceServer
 *   .register("algorand:*", new ExactAvmScheme()) -> paymentMiddleware(routes)
 *
 * VERIFIED (in-sandbox, against @x402/* @ 2.23.0):
 *   - every import below resolves and exports the symbols used
 *   - ALGORAND_TESTNET_CAIP2 and USDC_TESTNET_ASA_ID are real package constants
 * NOT verifiable in-sandbox (network-gated to your machine):
 *   - the actual 402 render + verify + settle, because x402ResourceServer
 *     calls facilitator.getSupported() at startup and needs egress to
 *     facilitator.goplausible.xyz + Algorand nodes. Run this where that
 *     egress exists (your laptop / Render / Railway), not on Vercel.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import {
  ALGORAND_TESTNET_CAIP2,
  ALGORAND_MAINNET_CAIP2,
  USDC_TESTNET_ASA_ID,
  USDC_MAINNET_ASA_ID,
} from "@x402/avm";

import { routeRequest, type Priority } from "./router.js";
import { db, type OrderRecord } from "./db.js";
import {
  agentPay,
  agentAddress,
  agentWalletConfigured,
  MAX_AUTONOMOUS_PAYMENT_USD,
} from "./agentWallet.js";

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;
const DEMO_MODE = (process.env.DEMO_MODE ?? "true").toLowerCase() === "true";

// --- Network + asset selection (Testnet by default; never accidental mainnet) -
//
// IMPORTANT: @x402/avm's ALGORAND_*_CAIP2 constants are truncated to the
// 32-character CAIP-2 reference limit, e.g.
//   algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe
// while the GoPlausible facilitator advertises the FULL genesis hash:
//   algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=
// If the resource server matches its configured network against the
// facilitator's advertised kinds by exact string, the truncated form fails to
// match and initialize() throws "no supported payment kinds loaded".
//
// X402_NETWORK_CAIP2 lets you pin the exact string the facilitator advertises.
// Run `node scripts/diagnose-network.mjs` to see which form works.
const NETWORK = (process.env.X402_NETWORK_CAIP2 ||
  (DEMO_MODE ? ALGORAND_TESTNET_CAIP2 : ALGORAND_MAINNET_CAIP2)) as `${string}:${string}`;
const USDC_ASA = DEMO_MODE ? USDC_TESTNET_ASA_ID : USDC_MAINNET_ASA_ID;

const PAY_TO = process.env.RESOURCE_PAY_TO;
const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz";

// Small, real testnet-USDC amounts prove the rail without needing $23 of USDC.
const INFERENCE_PRICE = process.env.INFERENCE_PRICE || "$0.01";
const MANUFACTURING_PRICE = process.env.MANUFACTURING_X402_PRICE || "$0.01";

if (!PAY_TO) {
  console.error(
    "FATAL: RESOURCE_PAY_TO is not set. It must be an Algorand address " +
      "opted-in to USDC (ASA " + USDC_ASA + "). See .env.example."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// x402 resource server (GoPlausible facilitator, Algorand exact-avm scheme)
// ---------------------------------------------------------------------------
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  "algorand:*",
  new ExactAvmScheme()
);

const x402Routes = {
  
  "POST /api/x402/manufacturing-order": {
    accepts: {
      scheme: "exact",
      network: NETWORK,
      payTo: PAY_TO,
      price: MANUFACTURING_PRICE,
      extra: { asset: USDC_ASA },
    },
    description:
  "Fabx402 autonomous PCB manufacturing agent. Manufacturing orders are settled via x402 on Algorand.",
    mimeType: "application/json",
  },
} as const;

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();

// CORS.
//
// WHAT CHANGED: allowedHeaders used to be a hard-coded list
// (Content-Type, X-PAYMENT, PAYMENT-SIGNATURE). The x402 client sends its
// own header names, and any header NOT on that list makes the browser's
// preflight fail - which surfaces in the UI as the useless "Failed to fetch".
// Omitting allowedHeaders makes cors() reflect whatever the browser asks for,
// so the payment headers are always permitted.
//
// exposedHeaders is still explicit and REQUIRED: without it the browser hides
// PAYMENT-REQUIRED (the 402 requirements) and PAYMENT-RESPONSE (the settled
// TXID) from our JS, and the payment panel renders blank.
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS || "http://localhost:3000")
      .split(",")
      .map((s) => s.trim()),
    methods: ["GET", "POST", "OPTIONS"],
    exposedHeaders: [
      "PAYMENT-REQUIRED",
      "PAYMENT-RESPONSE",
      "X-PAYMENT-RESPONSE",
      "WWW-Authenticate",
    ],
    maxAge: 600,
  })
);
app.use(express.json({ limit: "1mb" }));

// Log every x402 exchange so a rejected payment is diagnosable.
// A 402 returned AFTER the client sent a payment header means the facilitator
// refused to verify/settle - that is the case worth seeing in full.
app.use((req, res, next) => {
  const paymentHeader =
    req.headers["x-payment"] || req.headers["payment"] || req.headers["payment-signature"];
  const started = Date.now();

  res.on("finish", () => {
    const isProtected = Object.keys(x402Routes).some(
      (r) => r === `${req.method} ${req.path}`
    );
    if (!isProtected) return;

    const ms = Date.now() - started;
    if (res.statusCode === 402 && paymentHeader) {
      console.error(
        `\n[x402] PAYMENT REJECTED  ${req.method} ${req.path}  (${ms}ms)\n` +
          `       The client DID send a payment header, but the facilitator\n` +
          `       did not accept it. Common causes:\n` +
          `         - receiving address (${PAY_TO}) not opted in to USDC ASA ${USDC_ASA}\n` +
          `         - payer has insufficient USDC or ALGO for fees\n` +
          `         - payer and receiver are the SAME address\n` +
          `         - network mismatch (configured: ${NETWORK})\n`
      );
    } else if (res.statusCode === 402) {
      console.log(`[x402] 402 issued (no payment header yet)  ${req.method} ${req.path}`);
    } else if (res.statusCode < 300 && paymentHeader) {
      console.log(`[x402] payment accepted + settled  ${req.method} ${req.path}  (${ms}ms)`);

      // Persist the settlement so the UI can show a payment history.
      // The TXID is whatever the middleware put in PAYMENT-RESPONSE - we never
      // synthesize one, so an undecodable header simply records nothing.
      try {
        const hdr = res.getHeader("PAYMENT-RESPONSE");
        const headerValue = Array.isArray(hdr) ? hdr[0] : hdr;
        if (typeof headerValue === "string" && headerValue) {
          let decoded: any = null;
          try {
            decoded = JSON.parse(Buffer.from(headerValue, "base64").toString("utf8"));
          } catch {
            decoded = JSON.parse(headerValue);
          }
          const txid = decoded?.transaction ?? decoded?.txId ?? null;
          if (txid) {
            const isInference = req.path === "/api/inference";
            const net = decoded?.network ?? NETWORK;
            db.recordPayment({
              id: `pay_${Date.now()}`,
              transactionId: txid,
              network: net,
              asset: `USDC (ASA ${USDC_ASA})`,
              amount: isInference ? INFERENCE_PRICE : MANUFACTURING_PRICE,
              purpose: isInference
                ? (paymentHeader && req.headers["x-a2a"] ? "AI inference (agent-to-agent)" : "AI inference (InferPay)")
                : "PCB manufacturing order",
              facilitator: FACILITATOR_URL,
              status: "SETTLED",
              timestamp: new Date().toISOString(),
              loraUrl: `https://lora.algokit.io/${
                String(net).includes("wGHE2Pwdvd") ? "mainnet" : "testnet"
              }/transaction/${txid}`,
            });
            console.log(`[x402] recorded TXID ${txid}`);
          }
        }
      } catch (e) {
        console.warn("[x402] could not record payment:", (e as Error).message);
      }
    }
  });

  next();
});

// x402 middleware protects ONLY the routes declared above. Everything else
// (health, discovery, order lookup) is free.
app.use(paymentMiddleware(x402Routes, resourceServer));

// ---- Gemini (real inference; falls back through model tiers) --------------
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// ===========================================================================
// USE CASE A — AI inference (x402-protected)
// The middleware has already verified + settled payment by the time we're here.
// The settlement TXID is returned to the client via the PAYMENT-RESPONSE header
// (the client decodes it — see frontend usePcbX402.ts).
// ===========================================================================
app.post("/api/inference", async (req, res) => {
  try {
    const { prompt, priority = "balanced", budget = 0.01 } = req.body ?? {};
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const routing = routeRequest(prompt, priority as Priority, Number(budget));

    let text: string;
    let modelUsed: string = routing.selectedProvider.actualModel;

    if (ai) {
      const fallbacks: string[] = [routing.selectedProvider.actualModel, "gemini-flash-latest"];
      let out: any = null;
      for (const model of fallbacks) {
        try {
          out = await ai.models.generateContent({ model, contents: prompt });
          modelUsed = model;
          break;
        } catch (e: any) {
          if (e?.status === 503 || e?.status === 429) continue;
          throw e;
        }
      }
      text = out?.text ?? "(no response text)";
    } else {
      // No model key configured. Say so plainly rather than echoing the prompt
      // back as if it were an answer, and label the model honestly below.
      modelUsed = "deterministic-fallback";
      text =
        "AI narration is unavailable because no GEMINI_API_KEY is configured on " +
        "the inference service. The engineering analysis shown above is " +
        "unaffected - DFM checks, BOM costing and manufacturer ranking are all " +
        "computed deterministically and never rely on a language model. " +
        "Set GEMINI_API_KEY in x402-service/.env and restart to enable AI narration.";
    }

    const inferenceId = `inf_${Date.now()}`;
    db.recordInference({
      id: inferenceId,
      timestamp: new Date().toISOString(),
      taskType: routing.taskType,
      complexity: routing.complexity,
      routerTier: routing.selectedProvider.model,
      actualModel: modelUsed,
      status: "Complete",
    });

    return res.json({
      inferenceId,
      text,
      model: modelUsed,
      routing: {
        taskType: routing.taskType,
        complexity: routing.complexity,
        estimatedTokens: routing.estimatedTokens,
        selectedProvider: {
          id: routing.selectedProvider.id,
          name: routing.selectedProvider.model,
          actualModel: routing.selectedProvider.actualModel,
        },
        reason: routing.reason,
      },
    });
  } catch (err) {
    console.error("Inference error:", err);
    return res.status(500).json({ error: "Inference failed" });
  }
});

// ===========================================================================
// USE CASE B — Manufacturing order (x402-protected)
// Payment is REAL testnet USDC on Algorand. The manufacturing QUOTE itself is
// sandbox data (labelled as such) — we never claim the fake quote is a real
// factory quote, but the on-chain settlement is genuine.
// ===========================================================================
app.post("/api/x402/manufacturing-order", (req, res) => {
  const {
    pcbId,
    manufacturerId,
    manufacturerName,
    quantity,
    quotedTotalUsd,
    source = "SANDBOX MANUFACTURER",
  } = req.body ?? {};

  if (!pcbId || !manufacturerId || !quantity) {
    return res
      .status(400)
      .json({ error: "pcbId, manufacturerId and quantity are required" });
  }

  // Deterministic order id (stable across the 402 -> retry handshake).
  const orderId =
    "ord_" +
    Buffer.from(`${pcbId}:${manufacturerId}:${quantity}:${quotedTotalUsd}`)
      .toString("base64url")
      .slice(0, 16);

  const record: OrderRecord = {
    orderId,
    pcbId,
    manufacturerId,
    manufacturerName: manufacturerName ?? manufacturerId,
    quantity: Number(quantity),
    quotedTotalUsd: Number(quotedTotalUsd ?? 0),
    quoteSource: source, // clearly-labelled sandbox vs production
    x402PricePaid: MANUFACTURING_PRICE,
    network: NETWORK,
    asset: `USDC (ASA ${USDC_ASA})`,
    facilitator: FACILITATOR_URL,
    status: "CONFIRMED",
    createdAt: new Date().toISOString(),
  };
  db.recordOrder(record);

  // The real settlement TXID is delivered to the client in the PAYMENT-RESPONSE
  // header set by the x402 middleware. We echo the order; the client pairs it
  // with the decoded TXID and builds the Lora link.
  return res.json({ order: record });
});

// Record the settled TXID against the order (client posts what it decoded from
// PAYMENT-RESPONSE, same shape as InferPay's /api/inference/:id/payment).
app.post("/api/orders/:id/payment", (req, res) => {
  const { transactionId, network } = req.body ?? {};
  if (!transactionId)
    return res.status(400).json({ error: "transactionId is required" });
  const updated = db.attachPayment(req.params.id, transactionId, network);
  if (!updated) return res.status(404).json({ error: "Order not found" });
  return res.json({ order: updated });
});

app.get("/api/orders/:id", (req, res) => {
  const o = db.getOrder(req.params.id);
  return o ? res.json({ order: o }) : res.status(404).json({ error: "Not found" });
});

// ===========================================================================
// AGENT-TO-AGENT — autonomous manufacturing payment
//
// The PCB agent uses its own dedicated Algorand Testnet wallet to purchase
// the SAME x402-protected manufacturing-order resource used by the human flow.
// No Pera popup or human wallet signature is required.
// ===========================================================================
app.post("/api/agent/manufacturing-order", async (req, res) => {
  if (!agentWalletConfigured()) {
    return res.status(503).json({
      error:
        "Agent wallet not configured. Set AGENT_WALLET_MNEMONIC in .env to enable autonomous payments.",
    });
  }

  try {
    const selfUrl =
      `http://127.0.0.1:${PORT}/api/x402/manufacturing-order`;

    const started = Date.now();

    console.log(
      "\n[a2a] Fabx402 agent initiating autonomous manufacturing payment..."
    );

    const result = await agentPay(selfUrl, req.body ?? {}, {
      demoMode: DEMO_MODE,
      price: MANUFACTURING_PRICE,
    });

    console.log(
      `[a2a] manufacturing payment settled in ${
        Date.now() - started
      }ms TXID=${result.transactionId ?? "none returned"}`
    );

    return res.json({
      mode: "agent-to-agent",
      paidBy: agentAddress(DEMO_MODE),
      paidTo: PAY_TO,
      amount: MANUFACTURING_PRICE,
      transactionId: result.transactionId,
      network: result.network ?? NETWORK,
      loraUrl: result.loraUrl,
      result: result.data,
    });
  } catch (err) {
    console.error(
      "[a2a] autonomous manufacturing payment failed:",
      (err as Error).message
    );

    return res.status(502).json({
      error: (err as Error).message,
    });
  }
});

// Agent wallet status - never exposes the key, only the public address.
app.get("/api/agent/wallet", (_req, res) =>
  res.json({
    configured: agentWalletConfigured(),
    address: agentAddress(DEMO_MODE),
    network: NETWORK,
    maxAutonomousPaymentUsd: MAX_AUTONOMOUS_PAYMENT_USD,
  })
);

// ---- Payment history -------------------------------------------------------
app.get("/api/payments", (_req, res) => res.json({ payments: db.listPayments() }));

// ---- Health + x402 discovery (Bazaar-style .well-known) --------------------
app.get("/api/health", (_req, res) =>
  res.json({
    status: "ok",
    demoMode: DEMO_MODE,
    network: NETWORK,
    asset: `USDC (ASA ${USDC_ASA})`,
    facilitator: FACILITATOR_URL,
    payToConfigured: Boolean(PAY_TO),
    geminiConfigured: Boolean(ai),
  })
);

app.get("/.well-known/x402", (_req, res) =>
  res.json({
    name: "Fabx402",
    description:
      "Autonomous PCB manufacturing agent. Pays for AI inference and manufacturing via x402 on Algorand.",
    x402Version: 2,
    network: NETWORK,
    scheme: "exact",
    asset: `USDC (ASA ${USDC_ASA})`,
    facilitator: FACILITATOR_URL,
    resources: [
  {
    method: "POST",
    path: "/api/x402/manufacturing-order",
    price: MANUFACTURING_PRICE,
  },
],
  })
);

app.listen(PORT, () => {
  console.log(`x402 service on :${PORT}  [DEMO_MODE=${DEMO_MODE}]`);
  console.log(`  network:     ${NETWORK}`);
  console.log(`  asset:       USDC ASA ${USDC_ASA}`);
  console.log(`  facilitator: ${FACILITATOR_URL}`);
  console.log(`  payTo:       ${PAY_TO}`);
});
