/**
 * scripts/test-x402-algorand.mjs  (Part 34 - critical validation script)
 *
 * v2 NOTE: x402 v2 returns payment requirements in the `PAYMENT-REQUIRED`
 * response HEADER (base64 JSON), not the body. v1 used the body. We read the
 * header first and fall back to the body.
 *
 * Run:  node scripts/test-x402-algorand.mjs   (service must be running)
 */
import "dotenv/config";

const BASE = process.env.SERVICE_URL || "http://localhost:3001";
const FACILITATOR = process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz";

let failed = false;
const ok = (m) => console.log(`\u2713 ${m}`);
const bad = (m) => { failed = true; console.log(`\u2717 ${m}`); };
const info = (m) => console.log(`  ${m}`);

function decodePaymentRequired(headerValue) {
  if (!headerValue) return null;
  try { return JSON.parse(Buffer.from(headerValue, "base64").toString("utf8")); }
  catch { try { return JSON.parse(headerValue); } catch { return null; } }
}

async function main() {
  try {
    const avm = await import("@x402/avm");
    ok("x402 package loaded (@x402/avm)");
    info(`Testnet USDC ASA: ${avm.USDC_TESTNET_ASA_ID}`);
    if (String(avm.USDC_TESTNET_ASA_ID) !== "10458941") bad(`Unexpected USDC ASA (${avm.USDC_TESTNET_ASA_ID})`);
    else ok("Algorand Testnet configured (USDC ASA 10458941)");
  } catch (e) { bad(`@x402/avm not installed: ${e.message}`); }

  if (process.env.RESOURCE_PAY_TO) ok(`RESOURCE_PAY_TO set (${process.env.RESOURCE_PAY_TO.slice(0,8)}...)`);
  else bad("RESOURCE_PAY_TO missing");

  if (process.env.X402_NETWORK_CAIP2) ok(`Network pinned (${process.env.X402_NETWORK_CAIP2.slice(0,28)}...)`);
  else info("X402_NETWORK_CAIP2 not set - package constant is truncated and may not match facilitator.");

  try {
    const r = await fetch(`${FACILITATOR}/supported`);
    if (r.ok) ok(`GoPlausible reachable (${FACILITATOR})`);
    else bad(`GoPlausible returned ${r.status} at /supported`);
  } catch (e) { bad(`GoPlausible unreachable: ${e.message}`); }

  try {
    const r = await fetch(`${BASE}/api/x402/manufacturing-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pcbId: "demo", manufacturerId: "mfr_b", quantity: 5, quotedTotalUsd: 23 }),
    });

    if (r.status === 402) {
      ok("402 response received (no payment)");
      const header = r.headers.get("PAYMENT-REQUIRED");
      let decoded = decodePaymentRequired(header);
      if (!decoded) {
        const body = await r.json().catch(() => ({}));
        if (body && (body.accepts || body.x402Version)) decoded = body;
      }
      const accepts = decoded?.accepts ?? (decoded?.network ? [decoded] : null);

      if (accepts && accepts.length) {
        ok("Payment requirements present");
        const a = accepts[0];
        info(`network: ${a.network}`);
        info(`asset:   ${a.asset ?? "(default USDC)"}`);
        info(`price:   ${a.price ?? a.maxAmountRequired}`);
        info(`payTo:   ${a.payTo}`);
      } else {
        bad("402 received but requirements could not be decoded");
        console.log("\n  --- diagnostic: raw response ---");
        console.log("  headers:");
        for (const [k, v] of r.headers.entries()) console.log(`    ${k}: ${String(v).slice(0,200)}`);
        console.log(`  PAYMENT-REQUIRED raw: ${String(header).slice(0,400)}`);
      }
    } else if (r.status === 500) {
      bad("Endpoint 500 - resource server failed to init");
      info("If the service says 'Facilitator does not support scheme exact on network ...',");
      info("set X402_NETWORK_CAIP2 in .env to the full string the facilitator advertises.");
    } else {
      bad(`Expected 402, got ${r.status}`);
    }
  } catch (e) {
    bad(`Service unreachable at ${BASE}: ${e.message} - run 'npm run start' first`);
  }

  console.log("");
  console.log("The remaining steps require a funded Pera wallet approving the payment:");
  console.log("  o Payment payload created  (browser: @x402/fetch + ExactAvmScheme client signer)");
  console.log("  o GoPlausible verifies      (facilitator /verify)");
  console.log("  o GoPlausible settles       (facilitator /settle -> Algorand Testnet)");
  console.log("  o Real TXID returned         (PAYMENT-RESPONSE header)");
  console.log("  o Confirm on Lora            https://lora.algokit.io/testnet/transaction/<TXID>");
  console.log("");
  console.log("Run the live demo to exercise those (they cannot be signed unattended).");
  console.log("\n" + (failed ? "PREREQUISITES: FAILED (fix the X items above)" : "PREREQUISITES: PASSED - ready for a live wallet payment"));
  setTimeout(() => process.exit(failed ? 1 : 0), 150);
}
main();
