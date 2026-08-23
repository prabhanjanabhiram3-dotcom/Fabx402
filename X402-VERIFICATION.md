# x402 on Algorand — verification guide

This document maps each of the five published evaluation criteria to the exact
file, line and command that demonstrates it. Everything below can be checked
without running the project; everything can also be reproduced by running it.

---

## 1. x402 payment flow is live on Algorand Testnet

**Two distinct paid endpoints**, both protected by the official x402 Express
middleware and settled on Algorand Testnet:

| Endpoint | Purpose | Price |
|---|---|---|
| `POST /api/inference` | AI inference via the InferPay model router | $0.01 USDC |
| `POST /api/x402/manufacturing-order` | Manufacturing order settlement | $0.01 USDC |

Source: `x402-service/src/server.ts`

```ts
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("algorand:*", new ExactAvmScheme());

app.use(paymentMiddleware(x402Routes, resourceServer));
```

Network and asset are pinned explicitly:

```ts
accepts: {
  scheme: "exact",
  network: NETWORK,              // algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=
  payTo: PAY_TO,
  price: "$0.01",
  extra: { asset: USDC_ASA },    // 10458941 (testnet USDC)
}
```

---

## 2. A real transaction, verifiable on Lora

> **FILL THIS IN BEFORE SUBMITTING.** Run one payment of each type, open the
> Transactions panel in the app, and paste the two transaction IDs here.

**AI inference payment**

- TXID: `<PASTE>`
- Lora: `https://lora.algokit.io/testnet/transaction/<PASTE>`

**Manufacturing payment**

- TXID: `<PASTE>`
- Lora: `https://lora.algokit.io/testnet/transaction/<PASTE>`

These IDs are produced by the facilitator's settlement response and are never
synthesized. The application stores a payment record **only** when the
`PAYMENT-RESPONSE` header actually contains a transaction id
(`x402-service/src/server.ts`, the `res.on("finish")` handler). If settlement
returns no id, nothing is recorded and the UI states that no transaction id was
returned rather than displaying a placeholder.

In-app: the **Transactions** button in the header lists every settled payment
with its real TXID and a working **View on Lora** link.

---

## 3. The flow uses the GoPlausible facilitator

Configured in `x402-service/.env`:

```
FACILITATOR_URL=https://facilitator.goplausible.xyz
```

Consumed in `x402-service/src/server.ts`:

```ts
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
```

The facilitator performs verification and settlement. The resource server also
queries `GET /supported` at startup — if the facilitator is unreachable the
service refuses to serve the protected routes rather than falling back to
anything local. There is **no mock facilitator in this codebase**; the local
facilitator that existed in an earlier Base Sepolia prototype was deleted, along
with its entire payment module.

---

## 4. x402 AVM dependencies in package.json

`x402-service/package.json`:

```json
"@x402/avm":     "^2.19.0",
"@x402/core":    "^2.19.0",
"@x402/express": "^2.19.0",
"@x402/fetch":   "^2.23.0"
```

`frontend/package.json` (browser-side signing):

```json
"@x402/avm":  "^2.19.0",
"@x402/core": "^2.19.0",
"@x402/fetch": "^2.23.0",
"@txnlab/use-wallet-react": "^5.0.0",
"@txnlab/use-wallet-pera":  "^5.0.0"
```

**A note on package scopes.** Two scopes publish the AVM implementation:
`@x402/*` (currently 2.23.0) and `@x402-avm/*` (currently 2.6.1). This project
uses `@x402/*`, the scope used by InferPay's live deployed application, and the
imports are the official AVM ones:

```ts
import { ExactAvmScheme } from "@x402/avm/exact/server";   // server
import { ExactAvmScheme } from "@x402/avm/exact/client";   // browser signer
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";
```

**Gotcha worth knowing:** `@x402/avm` exports `ALGORAND_TESTNET_CAIP2`
truncated to the 32-character CAIP-2 reference limit
(`algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe`), while the GoPlausible
facilitator advertises the full genesis hash
(`algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=`). They do not match,
and the resource server rejects the route with
`RouteConfigurationError: missing_facilitator`. This project pins the full
string via `X402_NETWORK_CAIP2` in `.env`.

---

## 4b. Agent-to-agent (autonomous machine payments)

Beyond the human-signed flow, the PCB agent has its own Algorand wallet and
pays the inference service directly — no human signature.

- Endpoint: `POST /api/agent/infer`
- Implementation: `x402-service/src/agentWallet.ts`
- Signer: the package's own `toClientAvmSigner()`, the same `ClientAvmSigner`
  interface Pera satisfies in the browser
- Guardrails: testnet-only enforcement, per-payment spend ceiling, mnemonic
  from environment, key never logged or exposed

See [AGENT-TO-AGENT.md](./AGENT-TO-AGENT.md).

The split is deliberate: the agent settles small recurring inference costs
autonomously, while the irreversible manufacturing order still requires human
approval.

---

## 5. x402 is genuinely integrated, not decorative

The payment is **load-bearing**: the workflow cannot proceed without it.

- The AI recommendation is returned by the paid endpoint. No payment, no
  recommendation — there is no unpaid path to that text.
- The manufacturing order is created by the paid endpoint. No payment, no order.
- The client never asserts payment success. The browser sends a signed payload;
  the **server** verifies and settles through GoPlausible before any handler
  runs.

### Read these files, in this order

| File | What to look for |
|---|---|
| `x402-service/src/server.ts` | Resource server, both protected routes, settlement capture |
| `frontend/lib/x402.ts` | Browser flow: probe 402 → Pera signs → decode `PAYMENT-RESPONSE` |
| `frontend/components/X402PaymentPanel.tsx` | Payment UI, real TXID, Lora link, honest empty state |
| `x402-service/scripts/test-x402-algorand.mjs` | Prerequisite validator |

### Reproduce it in two minutes

```bash
cd x402-service
npm install
npm run start

# in a second terminal
node scripts/test-x402-algorand.mjs
```

Expected:

```
✓ x402 package loaded (@x402/avm)
✓ Algorand Testnet configured (USDC ASA 10458941)
✓ RESOURCE_PAY_TO set
✓ Network pinned
✓ GoPlausible reachable (https://facilitator.goplausible.xyz)
✓ 402 response received (no payment)
✓ Payment requirements present
    network: algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=
    asset:   10458941
PREREQUISITES: PASSED — ready for a live wallet payment
```

Raw 402 check:

```bash
curl -i -X POST http://localhost:3001/api/x402/manufacturing-order \
  -H "Content-Type: application/json" \
  -d '{"pcbId":"demo","manufacturerId":"mfr_b","quantity":5,"quotedTotalUsd":23}'
```

Returns `HTTP/1.1 402 Payment Required` with the requirements in the
`PAYMENT-REQUIRED` header (x402 v2 places them in the header, not the body).

---

## What is real and what is sandbox

Stated plainly, because the distinction matters more than the demo looking good:

| Real — never simulated | Sandbox — labelled as such |
|---|---|
| The 402 and its requirements | Manufacturer catalogue (3 fictional fabs) |
| Pera Wallet signature | Manufacturing quote amounts |
| GoPlausible verification | Sample PCB file |
| GoPlausible settlement | Parts catalogue pricing |
| Algorand Testnet USDC transfer | — |
| Transaction ID and Lora link | — |

The manufacturing endpoint settles a **real** testnet-USDC payment while the
quote it records is sandbox data, stored in a separately labelled field. A
fictional quote is never presented as a real factory quote.

DFM checks, BOM costing and manufacturer ranking are **deterministic** — plain
arithmetic over values extracted from the uploaded file. The language model
explains results it is handed; it never computes them.
