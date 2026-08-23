/**
 * diagnose-middleware.mjs — surface the REAL error behind the 500.
 *
 * `initialize()` succeeds standalone, and /api/health works, so the facilitator
 * and env are fine. That leaves the route configuration passed to
 * paymentMiddleware. This script rebuilds exactly that on a spare port (3099),
 * fires one unpaid request, and prints the full error chain instead of the
 * generic 500 the browser sees.
 *
 * Run:  node scripts\diagnose-middleware.mjs
 */
import "dotenv/config";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const FACILITATOR = process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz";
const PAY_TO = process.env.RESOURCE_PAY_TO;
const NETWORK = process.env.X402_NETWORK_CAIP2 || ALGORAND_TESTNET_CAIP2;
const PORT = 3099;

console.log("payTo   :", PAY_TO);
console.log("network :", NETWORK);
console.log("facilit.:", FACILITATOR);
console.log("");

process.on("unhandledRejection", (e) => {
  console.log("UNHANDLED REJECTION:");
  console.log(e);
});

const app = express();
app.use(express.json());

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  "algorand:*",
  new ExactAvmScheme()
);

const routes = {
  "POST /api/x402/manufacturing-order": {
    accepts: { scheme: "exact", network: NETWORK, payTo: PAY_TO, price: "$0.01" },
    description: "PCB manufacturing order",
    mimeType: "application/json",
  },
};

// Print the exact error the middleware throws, instead of a bare 500.
app.use((req, res, next) => {
  const origStatus = res.status.bind(res);
  res.status = (code) => {
    if (code >= 500) console.log(`\n>>> middleware responded ${code}`);
    return origStatus(code);
  };
  next();
});

app.use(paymentMiddleware(routes, resourceServer));
app.post("/api/x402/manufacturing-order", (_req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  console.log("\n=== ERROR FROM MIDDLEWARE ===");
  console.log("name   :", err?.name);
  console.log("message:", err?.message);
  if (err?.cause) {
    console.log("cause  :", err.cause?.message ?? String(err.cause));
    if (err.cause?.cause) console.log("cause2 :", String(err.cause.cause));
  }
  console.log("\nstack:");
  console.log(err?.stack);
  res.status(500).json({ error: err?.message });
});

const server = app.listen(PORT, async () => {
  console.log(`probe server on :${PORT} — sending one unpaid request…`);
  try {
    const r = await fetch(`http://localhost:${PORT}/api/x402/manufacturing-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pcbId: "demo", manufacturerId: "mfr_b", quantity: 5, quotedTotalUsd: 23 }),
    });
    console.log("\nHTTP status:", r.status, r.status === 402 ? "(EXPECTED — 402 works here)" : "");
    const text = await r.text();
    console.log("body:", text.slice(0, 600));
  } catch (e) {
    console.log("request failed:", e.message);
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 250);
  }
});
