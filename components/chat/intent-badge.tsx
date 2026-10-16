import type { EdgeIntent } from "@/lib/edge/types";
import { destinationLabel, intentLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";

const CONFIDENCE: Record<EdgeIntent["confidence"], { dot: string; word: string }> = {
  high: { dot: "bg-success", word: "" },
  medium: { dot: "bg-warning", word: "maybe" },
  low: { dot: "bg-destructive", word: "unsure" },
};

const TASK_LABEL: Record<string, string> = {
  lookup: "Lookup",
  compare: "Comparison",
  draft: "Draft",
  review: "Review",
  summarise: "Summary",
  summarize: "Summary",
  translate: "Translation",
  calculate: "Calculation",
  eligibility: "Eligibility check",
  process: "Process",
};

/**
 * Compact "what the classifier thought" pill under an answer: the task and topic in words,
 * the destinations, and — only when it matters — a word for a shaky confidence, so the dot
 * is never the sole signal.
 */
export function IntentBadge({ intent, className }: { intent: EdgeIntent & { task?: string }; className?: string }) {
  const label = intentLabel(intent.primary);
  if (!label) return null;
  const places = intent.destinations.filter((d) => d !== "other").map(destinationLabel).filter(Boolean);
  const task = intent.task ? TASK_LABEL[intent.task] ?? intentLabel(intent.task) : null;
  const confidence = CONFIDENCE[intent.confidence] ?? CONFIDENCE.medium;
  const detail = `Edge read this as: ${task ? `${task} · ` : ""}${label}${places.length ? ` · ${places.join(", ")}` : ""} · confidence ${intent.confidence}`;
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2 text-[11px] text-muted-foreground", className)} title={detail}>
      <span className={cn("h-1.5 w-1.5 rounded-full", confidence.dot)} aria-hidden />
      <span className="sr-only">{detail}</span>
      <span aria-hidden>
        {task ? `${task} · ` : ""}
        {label}
      </span>
      {places.length > 0 && (
        <span className="text-muted-foreground/80" aria-hidden>
          · {places.join(", ")}
        </span>
      )}
      {confidence.word && (
        <span className="rounded-full bg-warning-tint px-1.5 text-[10px] font-medium text-warning-foreground" aria-hidden>
          {confidence.word}
        </span>
      )}
    </span>
  );
}
