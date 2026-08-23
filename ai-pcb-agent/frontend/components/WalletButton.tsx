"use client";

/**
 * Pera Wallet connect/disconnect control.
 *
 * HYDRATION NOTE (this caused "Hydration failed because the initial UI does
 * not match what was rendered on the server"):
 * use-wallet restores a previous session from browser storage on mount, so on
 * the client `activeAccount` can be populated immediately, while the server
 * render always has it as null. React then sees two different trees and
 * throws.
 *
 * The fix is to render a stable placeholder until after the first client
 * render (`mounted`), so server and client agree on the initial HTML. Wallet
 * state is only consulted once we are definitely on the client.
 */

import { useEffect, useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { Wallet, LogOut, AlertTriangle } from "lucide-react";

export default function WalletButton() {
  const { wallets, activeAccount } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const peraWallet = wallets?.[0];

  async function connect() {
    if (!peraWallet) return;
    setBusy(true);
    setErr(null);
    try {
      await peraWallet.connect();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Wallet connection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!peraWallet) return;
    try {
      await peraWallet.disconnect();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Wallet disconnect failed.");
    }
  }

  // Server and first client render must match exactly.
  if (!mounted) {
    return (
      <div className="h-8 w-[168px] rounded-lg border border-base-700 bg-base-900/40" aria-hidden />
    );
  }

  if (activeAccount) {
    const short = `${activeAccount.address.slice(0, 6)}…${activeAccount.address.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-accent-500/30 bg-accent-500/5 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
          <span className="font-mono text-xs text-accent-300">{short}</span>
          <span className="text-[10px] uppercase tracking-wider text-base-600">Testnet</span>
        </div>
        <button
          onClick={disconnect}
          title="Disconnect wallet"
          className="rounded-lg border border-base-700 p-1.5 text-base-500 transition-colors hover:text-base-300"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={connect}
        disabled={busy || !peraWallet}
        className="flex items-center gap-2 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-base-950 transition-colors hover:bg-accent-400 disabled:opacity-50"
      >
        <Wallet className="h-3.5 w-3.5" />
        {busy ? "Connecting…" : "Connect Pera Wallet"}
      </button>
      {err && (
        <span className="flex items-center gap-1 text-[10px] text-red-400">
          <AlertTriangle className="h-3 w-3" /> {err}
        </span>
      )}
    </div>
  );
}
