# ⚡ Fabx402

### Autonomous PCB Manufacturing Agent powered by x402 on Algorand

Fabx402 is an AI-assisted PCB manufacturing workflow that takes a KiCad PCB design from engineering analysis to manufacturing payment.

Upload a `.kicad_pcb` file and Fabx402 automatically performs PCB analysis, Design for Manufacturability (DFM) checks, BOM analysis, sourcing evaluation, and manufacturer comparison.

Once the manufacturing plan and estimate are ready, the order can be approved and paid using either a connected wallet or an autonomous Fabx402 agent.

Payments are handled using the **x402 protocol on Algorand Testnet**, enabling both human-to-service and agent-to-service machine payments.

---

## 🚀 What Fabx402 Does

Fabx402 turns a PCB design into a manufacturing-ready workflow:

```text
KiCad PCB Upload
        ↓
PCB Analysis Agent
        ↓
DFM Agent
        ↓
BOM & Sourcing Agent
        ↓
Manufacturer Evaluation
        ↓
Manufacturing Plan + Estimate
        ↓
Approval
        ↓
┌──────────────────────────────┐
│       Payment Method         │
├──────────────────────────────┤
│ Pera Wallet                  │
│          OR                  │
│ Autonomous Fabx402 Agent     │
└──────────────────────────────┘
        ↓
x402 Payment
        ↓
GoPlausible Facilitator
        ↓
Algorand Testnet
        ↓
Manufacturing Order
        ↓
Transaction ID + Confirmation
```

---

## ✨ Core Features

### PCB Analysis

Fabx402 parses uploaded KiCad PCB files and extracts important board information including:

- Board dimensions
- Layer count
- Component count
- PCB structure and manufacturing parameters

### DFM Analysis

The DFM agent checks whether the PCB is suitable for manufacturing and reports passed and failed checks before an order is placed.

### BOM & Sourcing

The BOM agent analyzes components, estimates sourcing costs, and identifies potential sourcing risks.

### Manufacturer Comparison

Fabx402 evaluates available manufacturing options based on factors such as:

- Manufacturing price
- Lead time
- DFM compatibility
- Overall manufacturing score

A recommended manufacturer is presented while still allowing the user to select another option.

### Manufacturing Plan

Before any payment takes place, Fabx402 displays the manufacturing plan and estimated cost.

This keeps engineering analysis separate from payment execution.

### x402 Manufacturing Payment

The manufacturing-order endpoint is an x402-protected resource.

```text
POST /api/x402/manufacturing-order
```

A request without valid payment receives an HTTP `402 Payment Required` response.

After payment is completed and verified, the manufacturing order is created.

---

## 🤖 Agent-to-Agent Payments

Fabx402 supports autonomous machine-to-machine payments.

Instead of requiring a wallet popup, the Fabx402 agent can use its own dedicated Algorand wallet to pay for the manufacturing service.

```text
Fabx402 Agent
      ↓
Requests Manufacturing Resource
      ↓
HTTP 402 Payment Required
      ↓
Agent evaluates payment requirement
      ↓
Checks autonomous spending limit
      ↓
Signs payment using agent wallet
      ↓
Retries request with x402 payment
      ↓
GoPlausible Facilitator
      ↓
Algorand Testnet Settlement
      ↓
Manufacturing Order Created
```

This demonstrates an important x402 use case:

> An autonomous software agent can discover a paid resource, understand its payment requirement, pay for it, and continue its task without requiring a human to manually complete every transaction.

For safety, autonomous payments are restricted by a configurable spending ceiling.

---

## 👤 Human Payment Flow

Fabx402 also supports user-controlled payment through a connected Algorand wallet.

```text
User Approves Order
        ↓
x402 Payment Required
        ↓
Pera Wallet
        ↓
User Signs Transaction
        ↓
GoPlausible Facilitator
        ↓
Algorand Testnet
        ↓
Payment Settled
        ↓
Order Confirmed
```

This gives the user a choice between direct human authorization and autonomous agent execution.

---

## 🔐 Human vs Agent Payment

| Human Payment | Agent Payment |
|---|---|
| User initiates payment | Agent initiates payment |
| Pera wallet is used | Dedicated agent wallet is used |
| User signs transaction | Agent signs automatically |
| Wallet popup appears | No wallet popup |
| x402 settlement | x402 settlement |
| Algorand Testnet | Algorand Testnet |

Both paths ultimately access the same paid manufacturing resource.

---

## 🧠 Agent Architecture

Fabx402 separates the manufacturing workflow into specialized components.

```text
                 ┌──────────────────┐
                 │   PCB Upload     │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │ PCB Analysis     │
                 │ Agent            │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │ DFM Agent        │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │ BOM Agent        │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │ Manufacturing    │
                 │ Agent            │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │ Manufacturing    │
                 │ Plan + Estimate  │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │ Approval & Pay   │
                 └──────┬───┬──────┘
                        │   │
             Human x402 │   │ Agent x402
                        │   │
                        ▼   ▼
                 ┌──────────────────┐
                 │ x402 Service     │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │ GoPlausible      │
                 │ Facilitator      │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │ Algorand Testnet │
                 └──────────────────┘
```

---

## 🏗️ Project Architecture

The repository is organized into three major applications:

```text
Fabx402/
│
├── ai-pcb-agent/
│   │
│   ├── frontend/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   │
│   ├── backend/
│   │   ├── agents/
│   │   ├── routes/
│   │   ├── tools/
│   │   └── data/
│   │
│   └── sample_data/
│
├── x402-service/
│   ├── src/
│   ├── scripts/
│   └── data/
│
├── AGENT-TO-AGENT.md
├── X402-VERIFICATION.md
└── README.md
```

### Frontend

Built with:

- Next.js
- React
- TypeScript
- Tailwind CSS
- Pera Wallet integration

The frontend handles the PCB workflow, manufacturing reports, wallet connection, approval, and payment UX.

### PCB Backend

Built with:

- Python
- FastAPI

The backend handles PCB processing and manufacturing analysis.

### x402 Service

Built with:

- Node.js
- TypeScript
- Express
- Algorand SDK
- x402 integration

This service exposes the paid manufacturing resource and handles both wallet-based and autonomous agent payment flows.

---

## 💳 x402 Integration

Fabx402 uses x402 to protect the manufacturing-order resource.

### Protected Resource

```http
POST /api/x402/manufacturing-order
```

Conceptually, the interaction works like this:

```text
Client
  │
  │ POST manufacturing order
  ▼
Fabx402 x402 Service
  │
  │ 402 Payment Required
  ▼
Client / Agent
  │
  │ Payment authorization
  ▼
Fabx402 x402 Service
  │
  │ Verification / Settlement
  ▼
GoPlausible Facilitator
  │
  ▼
Algorand Testnet
  │
  ▼
Order Created
```

The payment is therefore part of the HTTP resource-access flow rather than a separate checkout system.

---

## ⛓️ Algorand

Fabx402 currently operates on:

```text
Network: Algorand Testnet
Payment protocol: x402
Facilitator: GoPlausible
```

Successful settlements produce an Algorand transaction ID that can be inspected using an Algorand explorer such as Lora.

---

## 🛡️ Autonomous Agent Safety

The agent wallet is intentionally separated from the user's wallet.

Autonomous payments use a configurable spending ceiling:

```env
MAX_AUTONOMOUS_PAYMENT_USD=
```

Before paying for a resource, the agent verifies that the requested amount does not exceed its permitted autonomous spending limit.

This provides a simple safety boundary for machine-controlled payments.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js + React + TypeScript |
| Styling | Tailwind CSS |
| PCB Backend | FastAPI + Python |
| Payment Service | Node.js + Express + TypeScript |
| Blockchain | Algorand Testnet |
| Payment Protocol | x402 |
| Facilitator | GoPlausible |
| Wallet | Pera Wallet |
| Deployment | Vercel + Render |

---

## 🌐 Deployment Architecture

```text
Browser
   │
   ▼
Vercel
Fabx402 Frontend
   │
   ├──────────────► FastAPI Backend
   │                   │
   │                   ├─ PCB Analysis
   │                   ├─ DFM
   │                   ├─ BOM
   │                   └─ Manufacturer Evaluation
   │
   └──────────────► x402 Service
                       │
                       ├─ Human Payment
                       │
                       └─ Agent Payment
                              │
                              ▼
                         GoPlausible
                              │
                              ▼
                       Algorand Testnet
```

---

## ⚙️ Environment Variables

Do **not** commit real secrets, API keys, wallet mnemonics, or `.env` files.

Use the included `.env.example` files as templates.

### Frontend

```env
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_X402_SERVICE_URL=
```

### PCB Backend

```env
CORS_ORIGINS=
```

Additional backend variables can be configured according to `.env.example`.

### x402 Service

The x402 service requires configuration for the payment resource, network, facilitator, and autonomous agent.

Typical variables include:

```env
DEMO_MODE=
RESOURCE_PAY_TO=
FACILITATOR_URL=
X402_NETWORK_CAIP2=
MANUFACTURING_X402_PRICE=
AGENT_WALLET_MNEMONIC=
MAX_AUTONOMOUS_PAYMENT_USD=
CORS_ORIGINS=
```

Never expose `AGENT_WALLET_MNEMONIC` to the frontend.

---

## 💻 Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/prabhanjanabhiram3-dotcom/Fabx402.git
cd Fabx402
```

### 2. Start the FastAPI backend

```bash
cd ai-pcb-agent/backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### 3. Start the x402 service

Open another terminal:

```bash
cd x402-service
npm install
npm run dev
```

### 4. Start the frontend

Open another terminal:

```bash
cd ai-pcb-agent/frontend
npm install
npm run dev
```

Then open the local Next.js application in your browser.

---

## 🧪 Testing the Workflow

A sample KiCad PCB is included in:

```text
ai-pcb-agent/sample_data/
```

Use it to test the complete workflow:

1. Upload the `.kicad_pcb` file.
2. Review PCB and DFM analysis.
3. Review BOM and sourcing information.
4. Select a manufacturer.
5. Review the manufacturing plan and estimate.
6. Continue to approval.
7. Choose human wallet payment or autonomous agent payment.
8. Complete the x402 transaction.
9. Verify the returned transaction ID and order confirmation.

---

## 🔎 x402 Verification

Additional payment implementation and verification information is available in:

```text
X402-VERIFICATION.md
```

Agent-to-agent architecture and behavior are documented in:

```text
AGENT-TO-AGENT.md
```

These documents provide additional implementation details for reviewing the x402 integration.

---

## 🎯 Why Fabx402?

PCB manufacturing involves several disconnected steps:

```text
Design validation
→ DFM checking
→ BOM sourcing
→ Manufacturer comparison
→ Pricing
→ Approval
→ Payment
→ Manufacturing
```

Fabx402 combines these stages into one agent-driven workflow.

x402 adds another capability: software agents can become economic actors.

Instead of only recommending what should happen next, an agent can access a paid service, satisfy its payment requirement, and continue executing the workflow.

Fabx402 demonstrates that concept using PCB manufacturing as the real-world workflow.

---

## 🔮 Future Scope

Fabx402 can be extended with:

- Real PCB manufacturer APIs
- Live PCB quotations
- Component distributor APIs
- Dynamic BOM pricing
- Multi-agent manufacturer negotiation
- Autonomous procurement
- Production tracking
- Shipment tracking
- Agent spending policies
- Multi-provider x402 services
- Mainnet settlement

---

## 🏆 Built For

**x402 Global Challenge PreHack**

Fabx402 demonstrates:

**AI Agents × x402 × Algorand × Autonomous Payments × PCB Manufacturing**

---

## 📄 Disclaimer

Fabx402 is currently a hackathon prototype.

Blockchain transactions are performed on **Algorand Testnet**, and manufacturing orders are sandbox/demo manufacturing operations rather than real production orders.

Do not use production wallet credentials or valuable assets while testing.

---

## 👨‍💻 Repository

Fabx402 is open source and available on GitHub.

Built to explore a future where autonomous agents can analyze, decide, pay, and transact with digital services using open payment protocols.