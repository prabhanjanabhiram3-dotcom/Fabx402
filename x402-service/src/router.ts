/**
 * InferPay AI router — lifted from InferPay's server/index.ts (routeRequest).
 * Deterministic task-type + complexity classification, then tier selection.
 * (Parts 10/11: task analysis -> model routing.) Unchanged logic, typed.
 */
export type Priority =
  | "lowest-cost"
  | "balanced"
  | "highest-quality"
  | "lowest-latency";

const PROVIDERS = [
  { id: "inferlite", model: "InferLite", actualModel: "gemini-3.5-flash-lite", price: 0.001, quality: 7.4, latency: 420 },
  { id: "infercore", model: "InferCore", actualModel: "gemini-3.5-flash", price: 0.003, quality: 8.7, latency: 680 },
  { id: "inferpro", model: "InferPro", actualModel: "gemini-3.7-flash", price: 0.008, quality: 9.6, latency: 1100 },
] as const;

export function routeRequest(prompt: string, priority: Priority, budget: number) {
  const text = prompt.toLowerCase();

  let taskType = "General";
  if (/code|function|bug|api|class|compile|refactor|program|typescript|javascript|python/.test(text)) taskType = "Coding";
  else if (/architecture|system design|scalable|infrastructure|marketplace|routing|distributed system/.test(text)) taskType = "Reasoning";
  else if (/summar|tldr|shorten|condense/.test(text)) taskType = "Summarization";
  else if (/translate/.test(text)) taskType = "Translation";
  else if (/solve|calculate|equation|integral|matrix|proof|theorem/.test(text)) taskType = "Math";
  else if (/why|reason|analyze|compare|evaluate|recommend|explain|justify/.test(text)) taskType = "Reasoning";

  const estimatedTokens = Math.max(120, Math.round(prompt.length / 4) + 220);

  let score = 0;
  if (estimatedTokens > 350) score += 1;
  if (estimatedTokens > 700) score += 1;
  for (const s of ["analyze", "compare", "evaluate", "recommend", "reason", "explain why", "trade-off", "tradeoffs", "deduce", "justify", "prove"]) {
    if (text.includes(s)) score += 1;
  }
  if (/debug|refactor|algorithm|architecture|optimization|integral|matrix|equation|proof|theorem/.test(text)) score += 1;
  let reqCount = 0;
  for (const w of ["and", "also", "then", "including", "consider", "based on"]) if (text.includes(w)) reqCount += 1;
  if (reqCount >= 2) score += 1;
  if (/architecture|system design|scalable|distributed|infrastructure|marketplace|multi-provider|multiple llm|fallback routing/.test(text)) score += 2;
  if (/minimize|maximize|optimize|latency|cost|reliability|failure|fallback|scalability/.test(text)) score += 1;
  const seps = (text.match(/,| and | then | while | also | with /g) || []).length;
  if (seps >= 3) score += 1;

  let complexity: "Low" | "Medium" | "High" = "Low";
  if (score >= 2) complexity = "Medium";
  if (score >= 4) complexity = "High";

  let candidates = PROVIDERS.filter((p) => p.price <= budget || budget === 0);
  if (candidates.length === 0) candidates = [...PROVIDERS];

  let selected = candidates[0];
  if (priority === "lowest-cost") selected = [...candidates].sort((a, b) => a.price - b.price)[0];
  else if (priority === "highest-quality") selected = [...candidates].sort((a, b) => b.quality - a.quality)[0];
  else if (priority === "lowest-latency") selected = [...candidates].sort((a, b) => a.latency - b.latency)[0];
  else {
    if (complexity === "Low") selected = candidates.find((p) => p.id === "inferlite") ?? candidates[0];
    else if (complexity === "High") selected = candidates.find((p) => p.id === "inferpro") ?? candidates[candidates.length - 1];
    else selected = candidates.find((p) => p.id === "infercore") ?? candidates[0];
  }

  return {
    taskType,
    complexity,
    estimatedTokens,
    selectedProvider: selected,
    reason:
      priority === "balanced"
        ? `${selected.model} selected for ${complexity.toLowerCase()} complexity with a balanced price/quality strategy.`
        : `${selected.model} selected using ${priority} routing priority.`,
  };
}
