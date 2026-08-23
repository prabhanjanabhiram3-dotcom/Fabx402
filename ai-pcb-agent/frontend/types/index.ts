export interface PCBAnalysis {
  board_width_mm: number;
  board_height_mm: number;
  area_mm2: number;
  layers: number;
  components: number;
  footprints: number;
  pads: number;
  vias: number;
  tracks: number;
  zones: number;
  min_trace_width_mm: number;
  min_clearance_mm: number;
  min_drill_diameter_mm: number;
  board_edge_clearance_mm: number;
  source: string;
}

export type Severity = "LOW" | "MEDIUM" | "HIGH";
export type DFMStatus = "PASS" | "WARNING" | "FAIL";

export interface DFMIssue {
  type: string;
  severity: Severity;
  actual: number;
  required: number;
  message: string;
}

export interface DFMCheck {
  name: string;
  passed: boolean;
}

export interface DFMResult {
  status: DFMStatus;
  total_checks: number;
  passed_checks: number;
  issues: DFMIssue[];
  checks: DFMCheck[];
  ai_summary?: string;
}

export type Availability = "AVAILABLE" | "LOW_STOCK" | "UNAVAILABLE";

export interface BOMItem {
  part: string;
  description: string;
  quantity: number;
  unit_cost_usd: number;
  availability: Availability;
  alternatives: string[];
}

export interface BOMResult {
  items: BOMItem[];
  total_cost_usd: number;
  risk_count: number;
  ai_summary?: string;
}

export interface ManufacturingQuote {
  manufacturer_id: string;
  manufacturer_name: string;
  price_usd: number;
  lead_time_days: number;
  dfm_compatible: boolean;
  layer_compatible: boolean;
  score: number;
  reasons: string[];
}

export interface ManufacturingRecommendation {
  recommended: ManufacturingQuote;
  all_quotes: ManufacturingQuote[];
  explanation: string;
}

export interface AgentEvent {
  id: string;
  project_id: string;
  agent: string;
  icon: string;
  message: string;
  status: "running" | "done" | "error";
  timestamp: string;
}

export interface OrderResult {
  status: string;
  order_id: string;
  manufacturer: string;
  quantity: number;
  total_price: number;
  estimated_delivery_days: number;
  payment?: {
    id: string;
    tx_hash?: string;
    status: string;
    network: string;
  };
}

export interface X402Requirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: Record<string, unknown>;
}

export interface X402Response {
  x402Version: number;
  error?: string;
  accepts: X402Requirements[];
}

export interface AnalysisBundle {
  pcb_analysis: PCBAnalysis;
  dfm_result: DFMResult;
  bom_result: BOMResult;
  recommendation: ManufacturingRecommendation;
}
