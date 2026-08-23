import type { DFMResult } from "@/types";
import { Check, AlertTriangle, X } from "lucide-react";

const statusStyles: Record<string, string> = {
  PASS: "text-accent-400 border-accent-500/30 bg-accent-500/10",
  WARNING: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  FAIL: "text-red-400 border-red-500/30 bg-red-500/10",
};

const severityColor: Record<string, string> = {
  LOW: "text-base-600",
  MEDIUM: "text-amber-400",
  HIGH: "text-red-400",
};

export default function DFMReport({ dfm }: { dfm: DFMResult }) {
  return (
    <div className="rounded-2xl border border-base-700 bg-base-900/60 p-6 fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">DFM Report</h3>
        <span className={`text-xs font-mono font-semibold uppercase px-2.5 py-1 rounded-full border ${statusStyles[dfm.status]}`}>
          {dfm.status}
        </span>
      </div>

      <div className="text-sm text-base-600 mb-4">
        {dfm.passed_checks} of {dfm.total_checks} checks passed
      </div>

      <div className="space-y-2 mb-4">
        {dfm.checks.map((c) => (
          <div key={c.name} className="flex items-center gap-2 text-sm">
            {c.passed ? (
              <Check className="h-4 w-4 text-accent-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            )}
            <span className={c.passed ? "text-base-200" : "text-amber-300"}>{c.name}</span>
          </div>
        ))}
      </div>

      {dfm.issues.length > 0 && (
        <div className="space-y-2 mb-4">
          {dfm.issues.map((issue, i) => (
            <div key={i} className="rounded-lg bg-base-850 border border-base-700 p-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono uppercase text-base-600">{issue.type.replace("_", " ")}</span>
                <span className={`font-semibold ${severityColor[issue.severity]}`}>{issue.severity}</span>
              </div>
              <p className="text-base-300">{issue.message}</p>
              <p className="text-base-600 mt-1 font-mono">
                actual: {issue.actual} · required: {issue.required}
              </p>
            </div>
          ))}
        </div>
      )}

      {dfm.ai_summary && (
        <div className="rounded-lg border border-accent-500/20 bg-accent-500/5 p-3 text-sm text-base-200">
          {dfm.ai_summary}
        </div>
      )}
    </div>
  );
}
