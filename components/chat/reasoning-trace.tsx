"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Atom, BookOpen, Brain, Check, ChevronDown, Database, Globe, GraduationCap, Loader2, X } from "lucide-react";
import { buildTimeline, STAGE_LABEL, type TimelineItem } from "@/lib/edge/reasoning";
import type { EdgeStage, ReasoningStep, ThoughtSegment } from "@/lib/edge/types";
import { cn } from "@/lib/utils";

/**
 * How the answer was reached, laid out the way deepseek.com shows its DeepThink: the
 * model's reasoning as plain paragraphs, and between them what it went and looked up
 * ("Searched the web · Read 2 pages"), in the order it happened.
 *
 * Nothing here is inferred. The backend streams the lookups as `tool` events and the
 * reasoning as `thinking` events; each thought carries how many lookups preceded it, so
 * a reopened thread rebuilds the same timeline from history. Open while the turn runs, so
 * the wait reads as working rather than dead air, then collapsed to a one-line summary
 * that reopens on click. That matters most for CRM answers: a counsellor needs to see
 * which records a figure came from before acting on it.
 */
export function ReasoningTrace({
  steps,
  stage,
  running,
  elapsedMs,
  thoughts,
  deepThink,
}: {
  steps: ReasoningStep[];
  /** Current phase while running; null once finished. */
  stage?: EdgeStage | null;
  running: boolean;
  /** Total turn time, once the backend reports it. */
  elapsedMs?: number;
  /** The model's reasoning, placed among the lookups. Absent on turns answered before it was stored. */
  thoughts?: ThoughtSegment[];
  /** Asked with DeepThink on. */
  deepThink?: boolean;
}) {
  const [open, setOpen] = useState(running);
  const [pinned, setPinned] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const items = useMemo(() => buildTimeline(steps, thoughts ?? []), [steps, thoughts]);
  const hasThoughts = items.some((i) => i.kind === "thought");

  // Follow the turn, then tuck away once it ends — unless the reader has taken control,
  // in which case their choice survives the running → finished transition.
  useEffect(() => {
    if (!pinned) setOpen(running);
  }, [running, pinned]);

  // Keep the newest line in view while it streams; thoughts grow word by word.
  useEffect(() => {
    if (open && running) list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [items, open, running]);

  if (items.length === 0 && !stage) return null;

  const lookups = steps.length;
  const summary = running
    ? stage
      ? STAGE_LABEL[stage]
      : "Thinking"
    : `Thought${elapsedMs ? ` for ${(elapsedMs / 1000).toFixed(1)}s` : ""}${lookups ? ` · ${lookups} lookup${lookups === 1 ? "" : "s"}` : ""}`;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => {
          setPinned(true);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="inline-flex max-w-full items-center gap-2 rounded-md py-1 pr-2 text-left text-[13px] font-medium text-muted-foreground transition hover:text-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        {running ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" /> : <Brain className="h-3.5 w-3.5 shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        {deepThink && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-tint px-1.5 py-0.5 text-[10px] font-semibold text-primary-strong">
            <Atom className="h-3 w-3" /> DeepThink
          </span>
        )}
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          ref={list}
          // aria-live="off" opts the reasoning out of the polite live region the streaming
          // message sits in: announcing every fragment would bury the answer. It stays in the
          // accessibility tree, so it is still readable by navigating to it.
          aria-live="off"
          className={cn(
            // One scroller for the whole panel, capped so a long thought scrolls here rather
            // than pushing the answer down the page. More room when there is prose.
            "mt-1.5 overflow-y-auto rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5",
            hasThoughts ? "max-h-96" : "max-h-60",
          )}
        >
          <ol className="space-y-3 border-l border-border pl-3.5">
            {items.map((item) => (
              <li key={item.key}>{item.kind === "thought" ? <Thought text={item.text} /> : <LookupGroup group={item} />}</li>
            ))}
            {/* Once something has run; before that the header already names the phase. */}
            {running && stage && items.length > 0 && (
              <li className="flex items-center gap-2 text-[12.5px] text-muted-foreground/80">
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
                <span>{STAGE_LABEL[stage]}</span>
              </li>
            )}
          </ol>
        </div>
      )}
    </div>
  );
}

/**
 * The model's own working, deliberately subordinate to the answer: smaller and muted, so
 * it reads as reasoning rather than a conclusion a counsellor could act on. Raw text, never
 * markdown: half-written thought is full of stray `*` and `#` that a renderer would flip
 * into headings and bold mid-stream.
 */
function Thought({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-muted-foreground">{text}</p>;
}

function groupIcon(steps: ReasoningStep[]) {
  const tools = new Set(steps.map((s) => s.key.slice(0, s.key.lastIndexOf(":"))));
  if ([...tools].every((t) => t.startsWith("crm_"))) return Database;
  if (tools.has("web_search") || tools.has("fetch_page")) return Globe;
  if (tools.has("search_programs") && tools.size === 1) return GraduationCap;
  return BookOpen;
}

function LookupGroup({ group }: { group: Extract<TimelineItem, { kind: "lookups" }> }) {
  const Icon = groupIcon(group.steps);
  const busy = group.steps.some((s) => s.state === "running");
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-foreground/80">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Icon className="h-3.5 w-3.5 text-primary" />}
        {group.title}
      </p>
      <ul className="mt-1 space-y-1">
        {group.steps.map((step) => (
          <li key={step.key} className="flex items-start gap-2 pl-5 text-[12px] leading-snug">
            <span className="mt-[3px] shrink-0">
              {step.state === "running" ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              ) : step.state === "failed" ? (
                <X className="h-3 w-3 text-destructive" />
              ) : (
                <Check className="h-3 w-3 text-success" />
              )}
            </span>
            <span className="min-w-0 break-words text-muted-foreground">
              {step.label}
              {step.ms !== undefined && step.state !== "running" && (
                <span className="ml-1.5 tabular-nums opacity-60">{step.ms < 1000 ? `${step.ms}ms` : `${(step.ms / 1000).toFixed(1)}s`}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
