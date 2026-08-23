"use client";

/**
 * PayWithX402 - the payment call to action.
 *
 * Replaces the previous "AI Reasoning (InferPay)" card, which spent a heading
 * and two lines of prose explaining the mechanism before offering the action.
 * The mechanism is already visible in the payment panel and the agent
 * timeline, so the copy was doing work the interface already does.
 *
 * What remains is the action itself, in ENIG gold - the colour reserved for
 * money throughout the product - with the price and network stated as a
 * caption rather than a sentence. The button names exactly what happens.
 */

import { Loader2 } from "lucide-react";

interface Props {
  onPay: () => void;
  busy: boolean;
  connected: boolean;
  price?: string;
  network?: string;
}

export default function PayWithX402({
  onPay,
  busy,
  connected,
  price = "$0.01 USDC",
  network = "Algorand Testnet",
}: Props) {
  return (
    <section className="fade-in-up flex flex-col items-center gap-3 py-2">
      <button
        onClick={onPay}
        disabled={busy || !connected}
        className="group relative flex items-center gap-3 rounded-lg border border-gold-500/40 bg-gold-500/10 px-7 py-3.5 transition-all hover:border-gold-500/70 hover:bg-gold-500/15 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-gold-500/40 disabled:hover:bg-gold-500/10"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-gold-400" />
        ) : (
          /* Pad-and-trace mark: the payment leaving the board. */
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4 shrink-0"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="5" cy="10" r="2.5" className="fill-gold-500" />
            <path
              d="M7.5 10h5.5l3 -3.5M13 10l3 3.5"
              className="stroke-gold-500"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <span className="font-display text-sm font-semibold tracking-tight text-gold-400">
          {busy ? "Settling payment…" : "Pay with x402"}
        </span>
        <span className="h-4 w-px bg-gold-500/30" aria-hidden="true" />
        <span className="font-mono text-xs text-gold-500/80">{price}</span>
      </button>

      <p className="label-tech">
        {connected ? network : "Connect your wallet to pay"}
      </p>
    </section>
  );
}
