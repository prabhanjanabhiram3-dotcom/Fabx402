/**
 * diagnose-network.mjs — find out WHY the resource server won't initialize.
 *
 * Hypothesis: @x402/avm's ALGORAND_TESTNET_CAIP2 constant is truncated to the
 * 32-char CAIP-2 reference limit, while the GoPlausible facilitator advertises
 * the full 44-char genesis hash. If the server matches exactly, nothing lines
 * up and initialize() throws "no supported payment kinds loaded".
 *
 * Run:  node scripts\diagnose-network.mjs
 */
import "dotenv/config";
import { x402ResourceServer } from "@x402/core/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const FACILITATOR = process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz";

console.log("Facilitator:", FACILITATOR);
console.log("");

// 1. What does the package think testnet is?
console.log("Package constant  :", JSON.stringify(ALGORAND_TESTNET_CAIP2));
console.log("  length          :", ALGORAND_TESTNET_CAIP2.length);

// 2. What does the facilitator actually advertise?
let advertised = [];
try {
  const r = await fetch(`${FACILITATOR}/supported`);
  const j = await r.json();
  advertised = (j.kinds || [])
    .map((k) => k.network)
    .filter((n) => typeof n === "string" && n.startsWith("algorand:"));
  console.log("");
  console.log("Facilitator advertises these Algorand networks:");
  advertised.forEach((n) => console.log("   ", JSON.stringify(n), `(len ${n.length})`));
} catch (e) {
  console.log("Could not read /supported:", e.message);
  process.exitCode = 1;
}

const testnetFull = advertised.find((n) => n.startsWith("algorand:SGO1"));
console.log("");
console.log(
  "Exact match between package constant and facilitator? ",
  advertised.includes(ALGORAND_TESTNET_CAIP2) ? "YES" : "NO  <-- likely the bug"
);

// 3. Try initializing with each candidate and see which survives.
async function tryInit(label, network) {
  if (!network) {
    console.log(`\n[${label}] skipped (value unavailable)`);
    return false;
  }
  try {
    const fc = new HTTPFacilitatorClient({ url: FACILITATOR });
    const server = new x402ResourceServer(fc).register("algorand:*", new ExactAvmScheme());
    await server.initialize();
    console.log(`\n[${label}] initialize() OK  network=${JSON.stringify(network)}`);
    return true;
  } catch (e) {
    console.log(`\n[${label}] initialize() FAILED`);
    console.log("   ", e.message);
    if (e.cause) console.log("    cause:", String(e.cause).split("\n")[0]);
    return false;
  }
}

await tryInit("package constant", ALGORAND_TESTNET_CAIP2);
await tryInit("facilitator full string", testnetFull);

console.log("");
if (testnetFull) {
  console.log("If the second form works, set this in your .env:");
  console.log(`X402_NETWORK_CAIP2=${testnetFull}`);
}
