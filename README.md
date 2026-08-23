# AI PCB Manufacturing Agent

**Powered by InferPay + x402 + Algorand**

> ### For judges
> **[X402-VERIFICATION.md](./X402-VERIFICATION.md)** maps every evaluation
> criterion to the exact file and command that proves it — live Algorand
> Testnet flow, verifiable Lora transactions, GoPlausible facilitator,
> `@x402/avm` dependencies, and where the payment is load-bearing in the
> workflow.
>
> Verified transactions: see the evidence section of that document.

An autonomous agent that reads a KiCad PCB design, validates its
manufacturability, analyses its bill of materials, evaluates manufacturing
options, and then **pays for both AI inference and manufacturing using real
x402 payments on Algorand Testnet** through the GoPlausible facilitator.

Every blockchain interaction in this project is real. No transaction IDs are
simulated.

---

## The workflow

```
Upload .kicad_pcb
      ↓
PCB Analysis Agent      (deterministic parse: dimensions, layers, vias, tracks)
      ↓
DFM Agent               (deterministic rule engine, per-manufacturer limits)
      ↓
BOM Agent               (real footprints extracted from the uploaded file)
      ↓
Manufacturer Discovery + Evaluation   (weighted ranking)
      ↓
InferPay AI Router      (task complexity → model tier)
      ↓
💰 x402 PAYMENT #1 → GoPlausible → Algorand Testnet → USDC
      ↓
AI Manufacturing Recommendation
      ↓
👤 HUMAN APPROVAL GATE
      ↓
💰 x402 PAYMENT #2 → GoPlausible → Algorand Testnet → USDC
      ↓
Manufacturing Order Confirmed  (+ real TXID, verifiable on Lora)
```

---

## Architecture

Three services, one product:

| Service | Stack | Responsibility |
|---|---|---|
| `frontend/` | Next.js 14, TypeScript, Tailwind | Dashboard, Pera Wallet signing, payment UI |
| `backend/` | Python, FastAPI | PCB parsing, DFM, BOM, manufacturer ranking. **Handles no money.** |
| `x402-service/` | Node, TypeScript, Express | Both x402-protected paid endpoints. **All payments.** |

**Why payments live in a separate Node service:** the official Algorand x402
libraries (`@x402/avm`, `@x402/core`, `@x402/express`) are TypeScript-only —
there is no Python SDK for the AVM `exact` scheme. Rather than reimplement
Algorand transaction signing by hand in Python, the payment layer is a Node
service and FastAPI stays focused on deterministic engineering analysis.

### The two paid endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/inference` | InferPay AI routing + inference |
| `POST /api/x402/manufacturing-order` | Manufacturing order settlement |

Both return a genuine `HTTP 402` with payment requirements, are verified and
settled by GoPlausible, and produce a real Algorand Testnet transaction.

---

## What is real vs. sandbox

Being explicit, because it matters:

| Real — never simulated | Sandbox — clearly labelled |
|---|---|
| HTTP 402 payment requirement | Manufacturer catalogue (3 fictional fabs) |
| Pera Wallet signature | Manufacturing quote amounts |
| GoPlausible verification | Sample PCB file |
| GoPlausible settlement | Parts catalogue pricing |
| Algorand Testnet USDC transfer | — |
| Returned transaction ID + Lora link | — |

The manufacturing endpoint settles a **real** testnet-USDC payment and stores
the sandbox quote separately. A fictional quote is never presented as a real
factory quote, and a blockchain result is never fabricated. If settlement
returns no transaction ID, the UI says so rather than inventing a hash.

Engineering analysis is **deterministic** — DFM checks, BOM costing and
manufacturer ranking are plain arithmetic against real extracted values. The
language model only ever explains results it is handed; it never computes them.

---

## Configuration

### Algorand / x402

| Setting | Value |
|---|---|
| Network | Algorand Testnet |
| Asset | USDC, ASA `10458941` |
| Facilitator | `https://facilitator.goplausible.xyz` |
| Scheme | `exact` (AVM) |
| Explorer | `https://lora.algokit.io/testnet/transaction/<TXID>` |

> **Note on the network string:** `@x402/avm` exports a CAIP-2 constant
> truncated to the 32-character reference limit, while the facilitator
> advertises the full genesis hash. They do not match, and the resource server
> rejects the route with `missing_facilitator`. Pin the full string via
> `X402_NETWORK_CAIP2` — see `x402-service/.env.example`.

---

## Setup

### 1. Testnet wallet

1. Install Pera Wallet, create an account, switch to **TestNet**.
2. Fund it with test ALGO: https://lora.algokit.io/testnet/fund
3. **Opt in to USDC** — Add Asset → `10458941`. Required; an Algorand account
   cannot receive an ASA it has not opted into.
4. Get test USDC from the Circle faucet with the network set to **Algorand Testnet**.
5. Create a **second** account for `RESOURCE_PAY_TO` and opt it in too. Payer
   and receiver must differ — a self-payment is rejected at settlement.

### 2. x402 service

```bash
cd x402-service
cp .env.example .env        # set RESOURCE_PAY_TO (and GEMINI_API_KEY if you have one)
npm install
npm run start               # :3001
```

Validate before demoing:

```bash
node scripts/test-x402-algorand.mjs
```

### 3. Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload    # :8000  (run from inside backend/)
```

### 4. Frontend

```bash
cd frontend
npm install
# .env.local:
#   NEXT_PUBLIC_API_URL=http://localhost:8000
#   NEXT_PUBLIC_X402_SERVICE_URL=http://localhost:3001
npm run dev                 # :3000
```

---

## Demo (3 minutes)

| Time | Action |
|---|---|
| 0:00 | Connect Pera Wallet, upload the sample PCB |
| 0:20 | PCB analysis — real dimensions, layers, vias |
| 0:40 | DFM checks and BOM, derived from the actual file |
| 1:00 | Manufacturer comparison with weighted scores |
| 1:20 | InferPay selects a model tier by task complexity |
| 1:35 | **HTTP 402 Payment Required** — real requirements from the server |
| 1:40 | Approve in Pera → GoPlausible verifies and settles |
| 1:50 | **Real Algorand TXID** appears |
| 1:55 | Open **View on Lora** — transaction confirmed on-chain |
| 2:10 | AI recommendation |
| 2:20 | Human approval → **Approve & Order** |
| 2:30 | Second x402 payment, second real transaction |
| 2:50 | Order confirmed. Transactions panel shows both payments |

---

## Why this design

**Why agentic:** an orchestrator runs PCB → DFM → BOM → manufacturer ranking as
discrete agents emitting timeline events, then an AI reasoning step, then a
human-approval gate before any irreversible order.

**Why x402:** each agent step that consumes a paid service pays per call over
HTTP 402 — no subscriptions, no pre-funded account per provider. This is what
machine-to-machine commerce needs.

**Why Algorand:** sub-cent fees and ~3 second finality make per-inference
micro-payments economically viable. USDC settles as an ASA via the AVM `exact`
scheme.

**How GoPlausible is used:** it is the facilitator that verifies and settles
both payments and returns the real transaction ID.

**What InferPay contributes:** the AI model router (task complexity → tier) and
the browser x402 payment flow, reused here as an internal service rather than a
separate dashboard.

---

## Security

- No private keys anywhere in the codebase. The browser signs via Pera.
- `.env` is git-ignored; only `.env.example` is committed.
- Payment success is never trusted from the client — the server verifies
  through GoPlausible before the workflow continues.
- Spend limit enforced server-side before any wallet prompt.
