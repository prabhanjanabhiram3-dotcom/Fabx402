"use client";

/**
 * Wallet provider — Pera on Algorand, pinned to TESTNET.
 *
 * Adapted from InferPay's src/main.tsx, with one deliberate change: InferPay
 * constructs `new WalletManager({ wallets: [pera()] })` with no network, so it
 * relies on the library default. We pin `defaultNetwork: NetworkId.TESTNET`
 * explicitly so the demo can NEVER accidentally sign against mainnet
 * (Part 25 / Part 17: "Never accidentally use mainnet").
 *
 * `defaultNetwork` and `NetworkId.TESTNET` are verified against
 * @txnlab/use-wallet v5's WalletManagerConfig.
 *
 * The manager is created inside useState so it is constructed once, on the
 * client only — wallet SDKs touch `window`, which would break during Next.js
 * server rendering.
 */

import { useState, type ReactNode } from "react";
import { WalletProvider, WalletManager, NetworkId } from "@txnlab/use-wallet-react";
import { pera } from "@txnlab/use-wallet-pera";

export default function Providers({ children }: { children: ReactNode }) {
  const [manager] = useState(
    () =>
      new WalletManager({
        wallets: [pera()],
        defaultNetwork: NetworkId.TESTNET,
      })
  );

  return <WalletProvider manager={manager}>{children}</WalletProvider>;
}
