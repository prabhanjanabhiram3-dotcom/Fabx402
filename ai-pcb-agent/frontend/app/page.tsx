"use client";

/**
 * Main dashboard — unified workflow (Part 3 / Part 23).
 *
 *   Upload -> PCB / DFM / BOM / Manufacturer agents (FastAPI, deterministic)
 *          -> [x402 PAYMENT #1] InferPay AI reasoning  (real Algorand USDC)
 *          -> AI recommendation
 *          -> HUMAN APPROVAL GATE
 *          -> [x402 PAYMENT #2] Manufacturing order    (real Algorand USDC)
 *          -> Order confirmation with real TXID + Lora link
 *
 * Both payments are signed in Pera and settled by GoPlausible. No stage is
 * advanced by a timer — every transition reflects something that actually
 * happened.
 */

import { useEffect, useRef, useState } from "react";
import { Cpu, ArrowLeft, ArrowRight } from "lucide-react";
import UploadSection from "@/components/UploadSection";
import PCBOverview from "@/components/PCBOverview";
import AgentTimeline from "@/components/AgentTimeline";
import DFMReport from "@/components/DFMReport";
import BOMReport from "@/components/BOMReport";
import ManufacturerComparison from "@/components/ManufacturerComparison";
import OrderPanel from "@/components/OrderPanel";
import OrderConfirmation from "@/components/OrderConfirmation";
import WalletButton from "@/components/WalletButton";
import TransactionHistory from "@/components/TransactionHistory";
import TitleBlock from "@/components/TitleBlock";
import PayWithX402 from "@/components/PayWithX402";
import AgentToAgentPanel from "@/components/AgentToAgentPanel";
import StepNav, { type Step } from "@/components/StepNav";
import Footer from "@/components/Footer";
import X402PaymentPanel from "@/components/X402PaymentPanel";
import { uploadPCB, analyzePCB, getEvents } from "@/lib/api";
import {
  usePcbX402,
  type X402Stage,
  type X402Requirement,
  type X402Settlement,
  agentManufacturingOrder,
} from "@/lib/x402";
import type { AnalysisBundle, AgentEvent, OrderResult } from "@/types";

interface PaymentState {
  stage: X402Stage;
  requirement: X402Requirement | null;
  settlement: X402Settlement | null;
  error?: string;
}

const IDLE: PaymentState = { stage: "requesting", requirement: null, settlement: null };

export default function Home() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [bundle, setBundle] = useState<AnalysisBundle | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [selectedMfrId, setSelectedMfrId] = useState("");
  const [error, setError] = useState<string | null>(null);



  // Payment #2 — manufacturing
  const [mfgPayment, setMfgPayment] = useState<PaymentState | null>(null);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [approving, setApproving] = useState(false);

  const [txRefresh, setTxRefresh] = useState(0);
  const [step, setStep] = useState(1);

  const { payAndCall, connected } = usePcbX402();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  async function handleFileReady(file: File) {
    setError(null);
    setBundle(null);
    setOrder(null);
    setEvents([]);
    setMfgPayment(null);
    setAnalyzing(true);
    setFilename(file.name);
    setStep(1);
    
    try {
      const { id } = await uploadPCB(file);
      setProjectId(id);

      pollRef.current = setInterval(async () => {
        try {
          setEvents(await getEvents(id));
        } catch {
          /* transient polling errors are fine */
        }
      }, 700);

      const result = await analyzePCB(id);
      setBundle(result);
      setSelectedMfrId(result.recommendation.recommended.manufacturer_id);
      setStep(2); // analysis is ready - move to it automatically

      setTimeout(async () => {
        try {
          setEvents(await getEvents(id));
        } catch {
          /* ignore */
        }
        if (pollRef.current) clearInterval(pollRef.current);
      }, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong analyzing the PCB.");
    } finally {
      setAnalyzing(false);
    }
  }

  /** The prompt both payment paths send. Built from the deterministic analysis. */

  /** Result handler for the autonomous agent-to-agent path. */

  /** PAYMENT #1 — pay for AI reasoning, then get the recommendation. */
  

  /** PAYMENT #2 — human-approved manufacturing order. */
  async function handleApprove(quantity: number, totalPrice: number) {
    if (!projectId || !bundle) return;
    setApproving(true);
    setMfgPayment({ ...IDLE });

    const quote = bundle.recommendation.all_quotes.find((q) => q.manufacturer_id === selectedMfrId);

    try {
      const out = await payAndCall<{ order: any }>(
        "/api/x402/manufacturing-order",
        {
          pcbId: projectId,
          manufacturerId: selectedMfrId,
          manufacturerName: quote?.manufacturer_name,
          quantity,
          quotedTotalUsd: totalPrice,
        },
        {
          onStage: (stage, requirement) =>
            setMfgPayment((p) => ({ ...(p ?? IDLE), stage, requirement: requirement ?? p?.requirement ?? null })),
        }
      );

      setMfgPayment((p) => ({ ...(p ?? IDLE), stage: "settled", settlement: out }));
      setTxRefresh((n) => n + 1);

      const o = out.data.order;
      setOrder({
        status: o.status,
        order_id: o.orderId,
        manufacturer: o.manufacturerName,
        quantity: o.quantity,
        total_price: o.quotedTotalUsd,
        estimated_delivery_days: quote?.lead_time_days ?? 0,
        payment: {
          id: o.orderId,
          tx_hash: out.transactionId ?? undefined,
          status: out.transactionId ? "SETTLED" : "UNKNOWN",
          network: out.network ?? "algorand-testnet",
        },
      });
    } catch (e) {
      setMfgPayment((p) => ({
        ...(p ?? IDLE),
        stage: "error",
        error: e instanceof Error ? e.message : "Manufacturing payment failed.",
      }));
    } finally {
      setApproving(false);
    }
  }

  async function handleAgentApprove(quantity: number, totalPrice: number) {
  if (!projectId || !bundle) return;

  setApproving(true);

  const quote = bundle.recommendation.all_quotes.find(
    (q) => q.manufacturer_id === selectedMfrId
  );

  try {
    const out = await agentManufacturingOrder({
      pcbId: projectId,
      manufacturerId: selectedMfrId,
      manufacturerName: quote?.manufacturer_name,
      quantity,
      quotedTotalUsd: totalPrice,
    });

    setTxRefresh((n) => n + 1);

    const o = (out.result as any).order;

    if (!o) {
      throw new Error("Manufacturing order was not returned by the agent service.");
    }

    setOrder({
      status: o.status,
      order_id: o.orderId,
      manufacturer: o.manufacturerName,
      quantity: o.quantity,
      total_price: o.quotedTotalUsd,
      estimated_delivery_days: quote?.lead_time_days ?? 0,
      payment: {
        id: o.orderId,
        tx_hash: out.transactionId ?? undefined,
        status: out.transactionId ? "SETTLED" : "UNKNOWN",
        network: out.network ?? "algorand-testnet",
      },
    });
  } catch (e) {
    console.error("Agent manufacturing payment failed:", e);

    alert(
      e instanceof Error
        ? e.message
        : "Agent manufacturing payment failed."
    );
  } finally {
    setApproving(false);
  }
}

  // A step unlocks only when the data it displays actually exists.
  const steps: Step[] = [
  { id: 1, label: "Upload board", unlocked: true },
  { id: 2, label: "Analysis & DFM", unlocked: Boolean(bundle) },
  { id: 3, label: "BOM & sourcing", unlocked: Boolean(bundle) },
  { id: 4, label: "Manufacturing plan", unlocked: Boolean(bundle) },
  { id: 5, label: "Approve & pay", unlocked: Boolean(bundle) },
];

  const selectedQuote = bundle?.recommendation.all_quotes.find(
    (q) => q.manufacturer_id === selectedMfrId
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8 border-b border-base-700 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent-500/40 bg-accent-500/10">
              <Cpu className="h-5 w-5 text-accent-400" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold text-[#E8EDE9]">
  Fabx402
</h1>

<p className="label-tech mt-0.5">
  Autonomous PCB Manufacturing · x402 · Algorand Testnet
</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TransactionHistory refreshKey={txRefresh} />
            <WalletButton />
          </div>
        </div>
      </header>

      <div className="mb-5">
        <TitleBlock
  bundle={bundle}
  selectedManufacturer={selectedMfrId}
  paymentsSettled={txRefresh}
/>
      </div>

      <div className="mb-6">
        <StepNav steps={steps} current={step} onSelect={setStep} />
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div key={step} className="fade-in-up space-y-6">
        {/* 01 - Upload */}
        {step === 1 && (
          <UploadSection onFileReady={handleFileReady} isBusy={analyzing} filename={filename} />
        )}

        {/* 02 - Analysis */}
        {step === 2 && bundle && (
          <>
            <PCBOverview pcb={bundle.pcb_analysis} />
            <DFMReport dfm={bundle.dfm_result} />
            <AgentTimeline events={events} />
          </>
        )}

        {/* 03 - Sourcing */}
        {step === 3 && bundle && (
          <>
            <BOMReport bom={bundle.bom_result} />
            <ManufacturerComparison
              recommendation={bundle.recommendation}
              selectedId={selectedMfrId}
              onSelect={setSelectedMfrId}
            />
          </>
        )}

        {/* 04 - Manufacturing plan */}
{step === 4 && bundle && (
  <div className="fade-in-up rounded-xl border border-base-700 bg-base-900/70 p-6">
    <div className="mb-4">
      <span className="label-tech">Manufacturing ready</span>

      <h3 className="mt-2 font-display text-xl font-semibold text-[#E8EDE9]">
        Manufacturing Plan
      </h3>

      <p className="mt-2 text-sm leading-relaxed text-base-300">
        PCB analysis, DFM checks, BOM sourcing and manufacturer evaluation
        are complete. Review the manufacturing plan and estimate before
        approving the order.
      </p>
    </div>

    <button
      onClick={() => setStep(5)}
      className="mt-4 rounded-lg bg-[#E8EDE9] px-5 py-3 text-sm font-semibold text-base-950 transition hover:opacity-90"
    >
      Continue to Approval
    </button>
  </div>
)}

        {/* 05 - Approval and manufacturing payment */}
        {step === 5 && bundle && (
          <>
            {selectedQuote && !order && (
              <OrderPanel
  quote={selectedQuote}
  dfm={bundle.dfm_result}
  onApprove={handleApprove}
  onAgentApprove={handleAgentApprove}
  disabled={approving}
/>
            )}

            {mfgPayment && (
              <X402PaymentPanel
                title="x402 Payment - Manufacturing Order"
                purpose="PCB Manufacturing Order (sandbox manufacturer, real payment)"
                stage={mfgPayment.stage}
                requirement={mfgPayment.requirement}
                settlement={mfgPayment.settlement}
                errorMessage={mfgPayment.error}
              />
            )}

            {order && <OrderConfirmation order={order} />}
          </>
        )}
      </div>

      {/* Step controls */}
      <div className="mt-8 flex items-center justify-between border-t border-base-700 pt-5">
        <button
          onClick={() => setStep((n) => Math.max(1, n - 1))}
          disabled={step === 1}
          className="flex items-center gap-2 rounded-lg border border-base-700 px-4 py-2 text-xs font-semibold text-base-400 transition-colors hover:border-base-600 hover:text-[#E8EDE9] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <span className="label-tech">
          Step {String(step).padStart(2, "0")} of 05
        </span>

        <button
          onClick={() => setStep((n) => Math.min(5, n + 1))}
          disabled={step === 5 || !steps[step]?.unlocked}
          className="flex items-center gap-2 rounded-lg border border-accent-500/40 bg-accent-500/10 px-4 py-2 text-xs font-semibold text-accent-400 transition-colors hover:border-accent-500/70 hover:bg-accent-500/15 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Next <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <Footer />

    </main>
  );
}
