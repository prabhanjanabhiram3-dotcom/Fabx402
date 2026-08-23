"use client";

/**
 * AGENT-TO-AGENT payment control.
 *
 * The distinction this expresses is the whole point of x402: the PCB agent
 * holds its own Algorand wallet and pays the inference service directly.
 * Nobody approves anything. No wallet popup appears. The agent transacts
 * because it needs the service.
 *
 * Shown alongside the human-signed option rather than replacing it, because
 * the two are used for different things here: the agent settles small,
 * recurring inference costs autonomously, while the irreversible
 * manufacturing order still requires a human signature. That split is a
 * deliberate safety design, not a limitation.
 */

import { useEffect, useState } from "react";
import { Bot, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { agentInfer, getAgentWallet, type AgentWalletStatus, type AgentPayResult } from "@/lib/x402";

interface Props {
  buildPrompt: () => unknown;
  onResult: (r: AgentPayResult) => void;
}

export default function AgentToAgentPanel({ buildPrompt, onResult }: Props) {
  const [wallet, setWallet] = useState<AgentWalletStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentPayResult | null>(null);

  useEffect(() => {
    getAgentWallet().then(setWallet);
  }, []);

  // Feature is off unless a wallet mnemonic is configured on the service.
  if (!wallet?.configured) return null;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await agentInfer(buildPrompt());
      setResult(r);
      onResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Autonomous payment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="fade-in-up rounded-xl border border-accent-500/30 bg-base-900/70 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Bot className="h-4 w-4 text-accent-400" />
        <h3 className="font-display text-sm font-semibold text-[#E8EDE9]">
          Agent-to-agent payment
        </h3>
        <span className="ml-auto rounded border border-accent-500/40 bg-accent-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-400">
          autonomous
        </span>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-base-400">
        The PCB agent pays the inference service from its own wallet. No
        signature, no popup — machine-to-machine settlement on Algorand.
      </p>

      <dl className="mb-4 space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="label-tech">Agent wallet</dt>
          <dd className="truncate font-mono text-[11px] text-base-300">
            {wallet.address
              ? `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`
              : "—"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="label-tech">Spend ceiling</dt>
          <dd className="font-mono text-[11px] text-base-300">
            ${wallet.maxAutonomousPaymentUsd.toFixed(2)} per payment
          </dd>
        </div>
      </dl>

      <button
        onClick={run}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-accent-500/40 bg-accent-500/10 px-4 py-2.5 text-xs font-semibold text-accent-400 transition-colors hover:border-accent-500/70 hover:bg-accent-500/15 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Agent is paying…
          </>
        ) : (
          <>
            <Bot className="h-3.5 w-3.5" /> Let the agent pay
          </>
        )}
      </button>

      {error && (
        <p className="mt-3 flex items-start gap-2 text-xs text-red-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-accent-500/30 bg-accent-500/5 p-3">
          <div className="label-tech mb-1">Settled autonomously</div>
          {result.transactionId ? (
            <>
              <div className="break-all font-mono text-[11px] text-base-300">
                {result.transactionId}
              </div>
              {result.loraUrl && (
                <a
                  href={result.loraUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-400 hover:text-accent-300"
                >
                  View on Lora <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </>
          ) : (
            <p className="text-xs text-gold-400">
              The service returned success but no transaction id was present in the
              settlement header.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
