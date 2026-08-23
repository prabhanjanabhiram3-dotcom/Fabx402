"use client";

/**
 * x402 payment panel (Part 19).
 *
 * Every field shown comes from real data:
 *   - Amount / Network / Asset / Pay to  -> the server's actual 402 requirements
 *   - Transaction                        -> the settled Algorand TXID from the
 *                                           PAYMENT-RESPONSE header
 * If settlement details are missing, we SAY so rather than inventing a hash.
 *
 * Replaces the old PaymentActivity component, whose stages were advanced by
 * setTimeout regardless of what actually happened.
 */

import { Check, Loader2, XCircle, ExternalLink, CircleDashed } from "lucide-react";
import type { X402Stage, X402Requirement, X402Settlement } from "@/lib/x402";
import { formatRequirementAmount, networkLabel } from "@/lib/x402";

const FLOW: { key: X402Stage; label: string }[] = [
  { key: "requesting", label: "Agent requesting paid service" },
  { key: "required", label: "402 PAYMENT REQUIRED" },
  { key: "awaiting-signature", label: "Awaiting wallet approval (Pera)" },
  { key: "settling", label: "GoPlausible verifying & settling on Algorand" },
  { key: "settled", label: "Payment settled" },
];

interface Props {
  title: string;
  purpose: string;
  stage: X402Stage;
  requirement: X402Requirement | null;
  settlement?: X402Settlement | null;
  errorMessage?: string;
  facilitatorUrl?: string;
}

export default function X402PaymentPanel({
  title,
  purpose,
  stage,
  requirement,
  settlement,
  errorMessage,
  facilitatorUrl = "GoPlausible",
}: Props) {
  const currentIndex = FLOW.findIndex((s) => s.key === stage);
  const isError = stage === "error";
  const isSettled = stage === "settled";

  return (
    <div className="fade-in-up rounded-xl border border-gold-500/25 bg-base-900/70 p-6 shadow-gold">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-[#E8EDE9]">{title}</h3>
        <span className="rounded border border-gold-500/40 bg-gold-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold-400">
          x402
        </span>
      </div>

      {/* --- Requirements straight from the server's 402 ------------------- */}
      <dl className="mb-5 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="label-tech">Amount</dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-gold-500">
            {formatRequirementAmount(requirement)}
          </dd>
        </div>
        <div>
          <dt className="label-tech">Network</dt>
          <dd className="mt-1 text-sm text-white">{networkLabel(requirement?.network)}</dd>
        </div>
        <div>
          <dt className="label-tech">Facilitator</dt>
          <dd className="mt-1 text-sm text-white">{facilitatorUrl}</dd>
        </div>
        <div>
          <dt className="label-tech">Purpose</dt>
          <dd className="mt-1 text-sm text-white">{purpose}</dd>
        </div>
        {requirement?.payTo && (
          <div className="sm:col-span-2">
            <dt className="label-tech">Pay to</dt>
            <dd className="mt-1 break-all font-mono text-xs text-base-300">
              {requirement.payTo}
            </dd>
          </div>
        )}
      </dl>

      {/* --- Live stages --------------------------------------------------- */}
      <div className="space-y-3 border-t border-base-800 pt-4">
        {FLOW.map((step, i) => {
          const done = isSettled || currentIndex > i;
          const active = !isError && i === currentIndex && !isSettled;
          const pending = i > currentIndex;

          return (
            <div key={step.key} className="flex items-center gap-3 text-sm">
              {done ? (
                <Check className="h-4 w-4 shrink-0 text-accent-500" />
              ) : active ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-400" />
              ) : (
                <CircleDashed className="h-4 w-4 shrink-0 text-base-700" />
              )}
              <span
                className={
                  pending
                    ? "text-base-700"
                    : step.key === "required"
                    ? "font-mono text-gold-400"
                    : "text-base-200"
                }
              >
                {step.label}
              </span>
            </div>
          );
        })}

        {isError && (
          <div className="flex items-start gap-3 text-sm text-red-400">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage || "Payment could not be completed."}</span>
          </div>
        )}
      </div>

      {/* --- Settlement result -------------------------------------------- */}
      {isSettled && (
        <div className="mt-5 rounded-lg border border-gold-500/30 bg-gold-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gold-400">
            <Check className="h-4 w-4" /> Payment Verified &amp; Settled
          </div>

          {settlement?.transactionId ? (
            <>
              <div className="text-xs uppercase tracking-wide text-base-600">Transaction</div>
              <div className="mt-1 break-all font-mono text-xs text-base-200">
                {settlement.transactionId}
              </div>
              <div className="mt-1 text-xs text-base-500">
                {networkLabel(settlement.network ?? requirement?.network)}
              </div>
              {settlement.loraUrl && (
                <a
                  href={settlement.loraUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gold-500 px-3 py-2 text-xs font-semibold text-base-950 transition-colors hover:bg-gold-400"
                >
                  View on Lora <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </>
          ) : (
            /* Honest fallback — never invent a hash. */
            <p className="text-xs text-gold-400">
              The service returned success, but no settlement details were present in
              the PAYMENT-RESPONSE header, so no transaction ID can be shown. Check the
              x402 service logs before demoing.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
