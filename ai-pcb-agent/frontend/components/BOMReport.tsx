import type { BOMResult } from "@/types";
import { PackageCheck, PackageX, PackageMinus } from "lucide-react";

const icons: Record<string, JSX.Element> = {
  AVAILABLE: <PackageCheck className="h-4 w-4 text-accent-500" />,
  LOW_STOCK: <PackageMinus className="h-4 w-4 text-amber-400" />,
  UNAVAILABLE: <PackageX className="h-4 w-4 text-red-400" />,
};

export default function BOMReport({ bom }: { bom: BOMResult }) {
  return (
    <div className="rounded-2xl border border-base-700 bg-base-900/60 p-6 fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">BOM / Component Analysis</h3>
        <span className="text-xs font-mono text-base-600">${bom.total_cost_usd.toFixed(2)} / unit</span>
      </div>

      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1">
        {bom.items.map((item) => (
          <div key={item.part} className="flex items-start justify-between gap-3 rounded-lg bg-base-850 border border-base-700 p-3 text-sm">
            <div className="flex items-start gap-2 min-w-0">
              {icons[item.availability]}
              <div className="min-w-0">
                <div className="text-white font-mono text-sm truncate">{item.part}</div>
                <div className="text-base-600 text-xs">{item.description}</div>
                {item.alternatives.length > 0 && (
                  <div className="text-xs text-amber-400 mt-0.5">Alt: {item.alternatives.join(", ")}</div>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-base-300 text-xs">×{item.quantity}</div>
              <div className="text-base-600 text-xs font-mono">${item.unit_cost_usd}</div>
            </div>
          </div>
        ))}
      </div>

      {bom.ai_summary && (
        <div className="rounded-lg border border-accent-500/20 bg-accent-500/5 p-3 text-sm text-base-200">
          {bom.ai_summary}
        </div>
      )}
    </div>
  );
}
