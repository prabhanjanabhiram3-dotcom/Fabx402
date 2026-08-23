"use client";

/**
 * Transaction history.
 *
 * Lists every x402 payment this service has actually SETTLED on Algorand,
 * newest first, each with a working Lora link. The data comes from the
 * service's own record of the PAYMENT-RESPONSE header - if no transaction id
 * was returned, nothing is stored, so this list never contains a synthesized
 * hash.
 */

import { useCallback, useEffect, useState } from "react";
import { Receipt, ExternalLink, RefreshCw, X } from "lucide-react";
import { X402_SERVICE_URL, networkLabel } from "@/lib/x402";

interface PaymentRecord {
  id: string;
  transactionId: string;
  network: string;
  asset: string;
  amount: string;
  purpose: string;
  facilitator: string;
  status: string;
  timestamp: string;
  loraUrl: string;
}

export default function TransactionHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const [open, setOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${X402_SERVICE_URL}/api/payments`);
      if (!res.ok) throw new Error(`Service returned ${res.status}`);
      const data = await res.json();
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Could not load transactions: ${e.message}`
          : "Could not load transactions."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh on mount and whenever a new payment settles.
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="flex items-center gap-2 rounded-lg border border-base-700 px-3 py-1.5 text-xs font-medium text-base-300 transition-colors hover:border-base-600 hover:text-white"
      >
        <Receipt className="h-3.5 w-3.5" />
        Transactions
        {payments.length > 0 && (
          <span className="rounded-full bg-accent-500/15 px-1.5 py-0.5 font-mono text-[10px] text-accent-300">
            {payments.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-base-700 bg-base-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-base-800 px-6 py-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <Receipt className="h-4 w-4 text-accent-400" />
                x402 Payment History
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={load}
                  title="Refresh"
                  className="rounded-lg p-1.5 text-base-500 transition-colors hover:text-base-200"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-base-500 transition-colors hover:text-base-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
                  {error}
                </p>
              )}

              {!error && payments.length === 0 && !loading && (
                <p className="py-8 text-center text-sm text-base-500">
                  No settled payments yet. Complete an x402 payment and it will appear here
                  with its Algorand transaction ID.
                </p>
              )}

              <ul className="space-y-3">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-base-700 bg-base-850 p-4"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{p.purpose}</div>
                        <div className="mt-0.5 text-xs text-base-500">
                          {new Date(p.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md border border-accent-500/30 bg-accent-500/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-300">
                        {p.status}
                      </span>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <dt className="text-base-600">Amount</dt>
                        <dd className="font-mono text-accent-400">{p.amount}</dd>
                      </div>
                      <div>
                        <dt className="text-base-600">Network</dt>
                        <dd className="text-base-300">{networkLabel(p.network)}</dd>
                      </div>
                    </dl>

                    <div className="mt-2 break-all font-mono text-[11px] text-base-400">
                      {p.transactionId}
                    </div>

                    <a
                      href={p.loraUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-400 transition-colors hover:text-accent-300"
                    >
                      View on Lora <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
