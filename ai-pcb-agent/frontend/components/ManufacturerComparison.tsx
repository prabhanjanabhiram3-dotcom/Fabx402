import type { ManufacturingRecommendation } from "@/types";
import { Sparkles, Clock, DollarSign, ShieldCheck, ShieldAlert } from "lucide-react";

interface Props {
  recommendation: ManufacturingRecommendation;
  selectedId: string;
  onSelect: (manufacturerId: string) => void;
}

export default function ManufacturerComparison({ recommendation, selectedId, onSelect }: Props) {
  const bestId = recommendation.recommended.manufacturer_id;

  return (
    <div className="rounded-2xl border border-base-700 bg-base-900/60 p-6 fade-in-up">
      <h3 className="text-lg font-semibold text-white mb-4">Manufacturer Comparison</h3>

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        {recommendation.all_quotes.map((q) => {
          const isBest = q.manufacturer_id === bestId;
          const isSelected = q.manufacturer_id === selectedId;
          return (
            <button
              key={q.manufacturer_id}
              onClick={() => onSelect(q.manufacturer_id)}
              className={`text-left rounded-xl border p-4 transition-all ${
                isSelected
                  ? "border-accent-500 bg-accent-500/5 shadow-glow"
                  : "border-base-700 bg-base-850 hover:border-base-600"
              }`}
            >
              {isBest && (
                <div className="flex items-center gap-1 text-accent-400 text-xs font-semibold mb-2">
                  <Sparkles className="h-3.5 w-3.5" /> AI RECOMMENDED
                </div>
              )}
              <div className="text-white font-semibold mb-2">{q.manufacturer_name}</div>
              <div className="flex items-center gap-1 text-sm text-base-200 mb-1">
                <DollarSign className="h-3.5 w-3.5 text-base-600" /> ${q.price_usd.toFixed(2)}
              </div>
              <div className="flex items-center gap-1 text-sm text-base-200 mb-1">
                <Clock className="h-3.5 w-3.5 text-base-600" /> {q.lead_time_days} days
              </div>
              <div className="flex items-center gap-1 text-sm mb-2">
                {q.dfm_compatible ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-accent-500" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                )}
                <span className={q.dfm_compatible ? "text-base-400" : "text-red-400"}>
                  {q.dfm_compatible ? "DFM compatible" : "DFM incompatible"}
                </span>
              </div>
              <div className="text-xs font-mono text-base-600">Score: {q.score}/100</div>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-accent-500/20 bg-accent-500/5 p-3 text-sm text-base-200">
        {recommendation.explanation}
      </div>
    </div>
  );
}
