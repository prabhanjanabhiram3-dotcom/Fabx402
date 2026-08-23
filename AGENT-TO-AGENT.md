# Agent-to-agent payments

## What this adds

Until now every payment was signed by a **human** in Pera Wallet. That is
human-to-machine commerce. This adds the other half: the PCB agent holds its
own Algorand wallet and pays the inference service **itself** — no signature,
no popup, no human in the loop.

```
Browser  ->  POST /api/agent/infer          (free, the agent's entry point)
                  |
                  v   agent signs with ITS OWN wallet
             POST /api/inference            (x402-protected, real USDC)
                  |
                  v
             GoPlausible  ->  Algorand Testnet  ->  real TXID
```

The transaction is indistinguishable from a human-signed one. Same protocol,
same facilitator, same settlement, same Lora link. Only the signer differs.

## Why both paths still exist

This is a deliberate safety design, not a limitation:

| Payment | Signed by | Why |
|---|---|---|
| AI inference ($0.01, recurring) | **The agent, autonomously** | Small, frequent, reversible in effect — exactly what machine-to-machine settlement is for |
| Manufacturing order | **A human, in Pera** | Irreversible commitment of real money to a physical order |

An agent that can autonomously commit you to a manufacturing run is not a
feature. The approval gate stays where it matters.

## Setup

1. **Create a third Pera testnet account** — this becomes the agent's wallet.
   It must be different from `RESOURCE_PAY_TO`.
2. **Fund it** with test ALGO (fees) and test USDC (payments).
3. **Opt it in to USDC** — Add Asset -> `10458941`.
4. **Export its 25-word mnemonic** from Pera.
5. Add to `x402-service/.env`:

   ```
   AGENT_WALLET_MNEMONIC=word1 word2 ... word25
   MAX_AUTONOMOUS_PAYMENT_USD=0.10
   ```

6. Restart the service. Check it loaded:

   ```
   curl http://localhost:3001/api/agent/wallet
   ```

   Returns the agent's public address — never the key.

The "Agent-to-agent payment" card then appears on step 04, above the
human-signed option. If `AGENT_WALLET_MNEMONIC` is unset the card does not
render at all and nothing else changes.

## Safety, enforced in code

`src/agentWallet.ts` does not merely document these — it enforces them:

- **Testnet only.** Loading the wallet throws if `DEMO_MODE=false`.
- **Spend ceiling.** Any payment above `MAX_AUTONOMOUS_PAYMENT_USD` is refused
  before a transaction is built.
- **Mnemonic from environment only.** Never in source; `.env` is git-ignored.
- **Key never leaves the service.** Not logged, not returned by any endpoint,
  not sent to the browser. `/api/agent/wallet` exposes only the public address.

## For the demo

Run the autonomous payment first, then the human-approved one. The contrast is
the story:

> "The agent needed AI inference, so it paid for it itself — here is the
> transaction on Algorand. But it cannot order a physical board on its own.
> That still needs me."

That single sentence covers agentic commerce, real x402 settlement, and
responsible autonomy.
