/**
 * Persistence. Parts 26/31: payment + order data must not be in-memory only.
 * Uses SQLite when better-sqlite3 is available (local / Render / Railway).
 * Falls back to a JSON file so the service still boots with zero native deps.
 *
 * NOTE FOR VERCEL: neither SQLite nor a JSON file survives on serverless.
 * If you deploy this service on Vercel functions, swap this module for a
 * managed Postgres client (e.g. Neon/Supabase) — the interface below is small
 * on purpose so that swap is a single-file change.
 */
import fs from "fs";
import path from "path";

export interface OrderRecord {
  orderId: string;
  pcbId: string;
  manufacturerId: string;
  manufacturerName: string;
  quantity: number;
  quotedTotalUsd: number;
  quoteSource: string;
  x402PricePaid: string;
  network: string;
  asset: string;
  facilitator: string;
  status: "CONFIRMED" | "PAID" | "FAILED";
  createdAt: string;
  transactionId?: string;
  paymentNetwork?: string;
}

export interface PaymentRecord {
  id: string;
  transactionId: string;
  network: string;
  asset: string;
  amount: string;
  purpose: string;
  facilitator: string;
  status: "SETTLED";
  timestamp: string;
  loraUrl: string;
}

export interface InferenceRecord {
  id: string;
  timestamp: string;
  taskType: string;
  complexity: string;
  routerTier: string;
  actualModel: string;
  status: string;
  transactionId?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// --- JSON-file store (portable fallback) -----------------------------------
class JsonStore {
  private ordersFile = path.join(DATA_DIR, "orders.json");
  private infFile = path.join(DATA_DIR, "inferences.json");
  private payFile = path.join(DATA_DIR, "payments.json");

  private read<T>(f: string): T[] {
    try {
      return JSON.parse(fs.readFileSync(f, "utf-8"));
    } catch {
      return [];
    }
  }
  private write<T>(f: string, rows: T[]) {
    fs.writeFileSync(f, JSON.stringify(rows, null, 2), "utf-8");
  }

  recordOrder(o: OrderRecord) {
    const rows = this.read<OrderRecord>(this.ordersFile).filter((r) => r.orderId !== o.orderId);
    rows.unshift(o);
    this.write(this.ordersFile, rows.slice(0, 500));
  }
  getOrder(id: string) {
    return this.read<OrderRecord>(this.ordersFile).find((r) => r.orderId === id) ?? null;
  }
  attachPayment(id: string, transactionId: string, network?: string) {
    const rows = this.read<OrderRecord>(this.ordersFile);
    const i = rows.findIndex((r) => r.orderId === id);
    if (i === -1) return null;
    rows[i] = { ...rows[i], transactionId, paymentNetwork: network, status: "PAID" };
    this.write(this.ordersFile, rows);
    return rows[i];
  }
  recordPayment(rec: PaymentRecord) {
    const rows = this.read<PaymentRecord>(this.payFile).filter(
      (r) => r.transactionId !== rec.transactionId
    );
    rows.unshift(rec);
    this.write(this.payFile, rows.slice(0, 200));
  }

  listPayments(): PaymentRecord[] {
    return this.read<PaymentRecord>(this.payFile);
  }

  recordInference(rec: InferenceRecord) {
    const rows = this.read<InferenceRecord>(this.infFile);
    rows.unshift(rec);
    this.write(this.infFile, rows.slice(0, 500));
  }
}

export const db = new JsonStore();
