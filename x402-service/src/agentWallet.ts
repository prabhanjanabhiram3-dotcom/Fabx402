/**
 * AGENT WALLET - autonomous, agent-to-agent x402 payments.
 *
 * Every payment in this project up to now was signed by a HUMAN in Pera
 * Wallet. That is human-to-machine commerce. This module gives the PCB agent
 * its own Algorand wallet so it can pay another service directly, with no
 * human in the loop - which is the actual premise of x402: autonomous agents
 * settling for services they consume.
 *
 * The signer is built with the package's own `toClientAvmSigner`, the same
 * ClientAvmSigner interface Pera satisfies in the browser. The only
 * difference is where the signature comes from. The payment, the facilitator
 * verification, the settlement and the resulting transaction are identical.
 *
 * SAFETY - this is the one place the project holds a key, so the rules are
 * strict and enforced in code below, not just documented:
 *
 *   1. TESTNET ONLY. Refuses to load when DEMO_MODE is false.
 *   2. The mnemonic comes from the environment, never from source, and
 *      .env is git-ignored.
 *   3. A hard per-payment spend ceiling. An autonomous agent with a wallet
 *      and no ceiling is how you wake up to an empty account.
 *   4. Optional. If AGENT_WALLET_MNEMONIC is unset the feature is simply
 *      off and the human-signed flow is unaffected.
 *
 * The key is never logged, never returned by an endpoint, and never sent to
 * the browser.
 */

import algosdk from "algosdk";
import { toClientAvmSigner } from "@x402/avm";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";

export interface AgentPaymentResult {
  transactionId: string | null;
  network: string | null;
  loraUrl: string | null;
  data: unknown;
}

/** Hard ceiling per autonomous payment, in USD. */
export const MAX_AUTONOMOUS_PAYMENT_USD = Number(
  process.env.MAX_AUTONOMOUS_PAYMENT_USD || "0.10"
);

let cachedAddress: string | null = null;

/**
 * Build the agent's signer from its mnemonic.
 * Returns null when the agent wallet is not configured.
 */
function loadSigner(demoMode: boolean) {
  const mnemonic = process.env.AGENT_WALLET_MNEMONIC?.trim();
  if (!mnemonic) return null;

  if (!demoMode) {
    throw new Error(
      "Refusing to load the agent wallet with DEMO_MODE=false. This wallet is " +
        "for Algorand TESTNET only."
    );
  }

  const words = mnemonic.split(/\s+/);
  if (words.length !== 25) {
    throw new Error(
      `AGENT_WALLET_MNEMONIC must be 25 words (got ${words.length}).`
    );
  }

  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const privateKeyBase64 = Buffer.from(account.sk).toString("base64");
  const signer = toClientAvmSigner(privateKeyBase64);
  cachedAddress = signer.address;
  return signer;
}

/** The agent's own Algorand address, or null when not configured. */
export function agentAddress(demoMode: boolean): string | null {
  if (cachedAddress) return cachedAddress;
  try {
    const s = loadSigner(demoMode);
    return s ? s.address : null;
  } catch {
    return null;
  }
}

export function agentWalletConfigured(): boolean {
  return Boolean(process.env.AGENT_WALLET_MNEMONIC?.trim());
}

/** Parse "$0.01" into 0.01 for the spend check. */
function priceToUsd(price: string): number {
  const n = Number(String(price).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

/**
 * Pay for and call an x402-protected endpoint AUTONOMOUSLY.
 *
 * This is the agent-to-agent path: the PCB agent pays the inference service
 * itself. It runs the identical protocol the browser runs - 402, signed
 * payload, facilitator verify, facilitator settle - so the transaction that
 * lands on Algorand is indistinguishable from a human-signed one.
 */
export async function agentPay(
  url: string,
  body: unknown,
  opts: { demoMode: boolean; price: string }
): Promise<AgentPaymentResult> {
  const signer = loadSigner(opts.demoMode);
  if (!signer) {
    throw new Error(
      "Agent wallet is not configured. Set AGENT_WALLET_MNEMONIC in .env to " +
        "enable autonomous agent-to-agent payments."
    );
  }

  // Guardrail: never let the agent exceed its authorized ceiling.
  const amount = priceToUsd(opts.price);
  if (amount > MAX_AUTONOMOUS_PAYMENT_USD) {
    throw new Error(
      `Autonomous payment of $${amount} exceeds the agent's limit of ` +
        `$${MAX_AUTONOMOUS_PAYMENT_USD}. Raise MAX_AUTONOMOUS_PAYMENT_USD ` +
        `deliberately, or route this payment through human approval.`
    );
  }

  const client = new x402Client();
  client.setSpendControls(false);
  client.register("algorand:*", new ExactAvmScheme(signer));

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const res = await fetchWithPayment(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = `Agent payment failed (HTTP ${res.status}).`;
    if (res.status === 402) {
      detail =
        "The agent signed a payment but the facilitator rejected it. Check " +
        "that the agent wallet holds testnet USDC and ALGO, is opted in to " +
        "ASA 10458941, and is not the same address as RESOURCE_PAY_TO.";
    }
    throw new Error(detail);
  }

  const data = await res.json();

  let transactionId: string | null = null;
  let network: string | null = null;
  const header = res.headers.get("PAYMENT-RESPONSE");
  if (header) {
    try {
      const decoded: any = JSON.parse(
        Buffer.from(header, "base64").toString("utf8")
      );
      transactionId = decoded?.transaction ?? decoded?.txId ?? null;
      network = decoded?.network ?? null;
    } catch {
      /* leave null - we never synthesize a transaction id */
    }
  }

  return {
    data,
    transactionId,
    network,
    loraUrl: transactionId
      ? `https://lora.algokit.io/${
          network && network.includes("wGHE2Pwdvd") ? "mainnet" : "testnet"
        }/transaction/${transactionId}`
      : null,
  };
}
