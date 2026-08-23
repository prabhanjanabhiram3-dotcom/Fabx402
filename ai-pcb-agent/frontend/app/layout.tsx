import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "AI PCB Manufacturing Agent",
  description:
    "Powered by InferPay + x402 + Algorand. Autonomous PCB analysis, DFM, sourcing, and real on-chain x402 payment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-base-950 font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
