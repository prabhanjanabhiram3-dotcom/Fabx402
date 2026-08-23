"use client";

import { useState } from "react";
import type { ManufacturingQuote, DFMResult } from "@/types";
import { ShieldCheck, Bot } from "lucide-react";

interface Props {
  quote: ManufacturingQuote;
  dfm: DFMResult;
  onApprove: (quantity: number, totalPrice: number) => void;
  onAgentApprove: (quantity: number, totalPrice: number) => void;
  disabled: boolean;
}

export default function OrderPanel({
  quote,
  dfm,
  onApprove,
  onAgentApprove,
  disabled,
}: Props) {
  const [quantity, setQuantity] = useState(5);

  // Manufacturer prices are quoted for a standard 5-board prototype batch.
  const total =
    Math.round(((quote.price_usd * quantity) / 5) * 100) / 100;

  return (
    <div className="rounded-2xl border border-base-700 bg-base-900/60 p-6 fade-in-up">
      <h3 className="mb-4 text-lg font-semibold text-white">
        Order Panel
      </h3>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs uppercase tracking-wide text-base-600">
            Manufacturer
          </label>

          <div className="mt-1 font-medium text-white">
            {quote.manufacturer_name}
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-base-600">
            Lead time
          </label>

          <div className="mt-1 font-medium text-white">
            {quote.lead_time_days} days
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-base-600">
            Quantity
          </label>

          <input
            type="number"
            min={1}
            max={1000}
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, Number(e.target.value)))
            }
            className="mt-1 w-full rounded-lg border border-base-700 bg-base-850 px-3 py-2 font-mono text-white focus:border-accent-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-base-600">
            Total
          </label>

          <div className="mt-1 font-mono text-2xl font-semibold text-accent-400">
            ${total.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2 text-xs text-base-600">
        <ShieldCheck className="h-3.5 w-3.5" />

        DFM status:

        <span className="font-semibold text-base-300">
          {dfm.status}
        </span>
      </div>

      {/* Human signed x402 payment */}
      <button
        onClick={() => onApprove(quantity, total)}
        disabled={disabled}
        className="w-full rounded-xl bg-accent-500 py-3 font-semibold text-base-950 transition-colors hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled ? "Processing..." : "Approve & Pay with Pera"}
      </button>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-base-700" />
        <span className="text-[10px] uppercase tracking-widest text-base-500">
          OR
        </span>
        <span className="h-px flex-1 bg-base-700" />
      </div>

      {/* Autonomous agent-to-agent x402 payment */}
      <button
        onClick={() => onAgentApprove(quantity, total)}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent-500/40 bg-accent-500/10 py-3 font-semibold text-accent-400 transition-colors hover:bg-accent-500/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Bot className="h-4 w-4" />

        {disabled
          ? "Processing..."
          : "Let Fabx402 Agent Approve & Pay"}
      </button>

      <p className="mt-3 text-center text-[11px] text-base-500">
        Autonomous payment uses the Fabx402 agent wallet via x402 on
        Algorand Testnet.
      </p>
    </div>
  );
}