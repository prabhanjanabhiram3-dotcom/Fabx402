import type { OrderResult } from "@/types";
import { PartyPopper, ExternalLink } from "lucide-react";

export default function OrderConfirmation({ order }: { order: OrderResult }) {
  return (
    <div className="rounded-2xl border border-accent-500/40 bg-accent-500/5 p-6 fade-in-up shadow-glow">
      <div className="flex items-center gap-2 mb-4">
        <PartyPopper className="h-5 w-5 text-accent-400" />
        <h3 className="text-lg font-semibold text-white">Order Confirmed</h3>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <Field label="Order ID" value={order.order_id} mono />
        <Field label="Manufacturer" value={order.manufacturer} />
        <Field label="Quantity" value={String(order.quantity)} />
        <Field label="Total Price" value={`$${order.total_price.toFixed(2)}`} />
        <Field label="Status" value="MANUFACTURING" />
        <Field label="Estimated Delivery" value={`${order.estimated_delivery_days} days`} />
      </div>

      {order.payment && (
        <div className="rounded-lg bg-base-850 border border-base-700 p-3 text-xs font-mono text-base-400 space-y-1">
          <div>x402 payment: <span className="text-accent-400">SETTLED</span></div>
          <div>network: {order.payment.network}</div>
          {order.payment.tx_hash && (
            <div className="flex items-center gap-1 truncate">
              tx: {order.payment.tx_hash}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-base-600 uppercase tracking-wide">{label}</div>
      <div className={`text-white font-medium mt-1 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
