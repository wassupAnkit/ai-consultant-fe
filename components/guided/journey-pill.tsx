"use client";

import { ArrowRight, Check, ChevronDown, ExternalLink, RotateCcw, Sparkles, UserRound } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useChat } from "@/hooks/use-chat";
import { useGuide } from "@/hooks/use-guide";
import { useSourcesPanel } from "@/hooks/use-sources-panel";
import { initials, STEP_SHORT_LABEL } from "@/lib/edge/journey";
import type { StepStatus } from "@/lib/edge/types";
import { cn } from "@/lib/utils";

/**
 * The only standing piece of a guided session: one line in the top bar saying whose journey
 * this is and where it stands. Everything else happens in the conversation. The menu is for
 * the occasional jump (a student who is further along, a step to reopen) and the CRM record.
 */
export function JourneyPill() {
  const g = useGuide();
  const { activeSession } = useChat();
  const panel = useSourcesPanel();
  if (!g.guide) return null;
  const guide = g.guide;
  const name = g.student?.student?.name ?? activeSession?.title ?? "Student";
  const current = g.steps.find((s) => s.key === guide.currentStep);
  const statusOf = (k: string): StepStatus => guide.steps.find((s) => s.key === k)?.status ?? "not_started";
  const webUrl = g.student?.crm.ok ? g.student.crm.webUrl : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${name}'s journey: ${current ? `step ${current.order} of ${g.steps.length}, ${current.label}` : "loading"}. Open journey menu`}
          className="inline-flex h-9 min-w-0 max-w-[22rem] shrink-0 items-center gap-1.5 rounded-full border border-teal/35 bg-teal-tint/60 py-1 pl-1 pr-2 sm:gap-2 sm:pr-2.5 text-[13px] transition hover:border-teal hover:bg-teal-tint focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-[10.5px] font-semibold text-teal-foreground ring-1 ring-teal/30">{initials(name)}</span>
          <span className="hidden min-w-0 truncate font-medium text-heading sm:inline">{name}</span>
          <span className="hidden text-muted-foreground sm:inline" aria-hidden>
            ·
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-foreground">
            <span className={cn("h-2 w-2 rounded-full", guide.suggestion ? "bg-warning" : "bg-primary")} aria-hidden />
            {/* Phones keep only the position; the step name is in the menu and the placeholder. */}
            <span className="hidden sm:inline">{STEP_SHORT_LABEL[guide.currentStep]}</span>
            {current && (
              <span className="tabular-nums text-muted-foreground">
                {current.order}/{g.steps.length}
              </span>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Journey</span>
          <span className="block truncate font-heading text-[15px] text-heading">{name}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {guide.suggestion && guide.suggestion.toStep !== guide.currentStep && (
          <>
            <DropdownMenuItem onSelect={() => void g.moveTo(guide.suggestion!.toStep)} className="items-start gap-2.5">
              <Sparkles className="mt-0.5 text-teal-foreground dark:text-teal" />
              <span className="min-w-0">
                <span className="block font-medium">Edge suggests {g.steps.find((x) => x.key === guide.suggestion!.toStep)?.label}</span>
                <span className="block text-xs text-muted-foreground">{guide.suggestion.reason}</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {g.steps.map((s) => {
          const status = statusOf(s.key);
          const isCurrent = s.key === guide.currentStep;
          return (
            <DropdownMenuItem key={s.key} onSelect={() => void g.moveTo(s.key)} className={cn("gap-2.5", isCurrent && "bg-primary-tint/70")}>
              <span
                className={cn(
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                  status === "done" ? "bg-success text-white" : isCurrent ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
                )}
              >
                {status === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : s.order}
              </span>
              <span className={cn("min-w-0 flex-1 truncate", isCurrent && "font-medium text-heading")}>{s.label}</span>
              {isCurrent && <span className="text-[11px] text-primary-strong">now</span>}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        {current && statusOf(current.key) !== "done" && (
          <DropdownMenuItem onSelect={() => void g.completeCurrent()}>
            <ArrowRight /> {current.label} settled, move on
          </DropdownMenuItem>
        )}
        {current && statusOf(current.key) === "done" && (
          <DropdownMenuItem onSelect={() => void g.setStepStatus(current.key, "in_progress")}>
            <RotateCcw /> Reopen {current.label}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => {
            panel.setTab("student");
            panel.setOpen(true);
          }}
        >
          <UserRound /> Student record
        </DropdownMenuItem>
        {webUrl && (
          <DropdownMenuItem asChild>
            <a href={webUrl} target="_blank" rel="noreferrer">
              <ExternalLink /> Open in CRM
            </a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Under the newest answer of a guided session, in the follow-up chip row: the one-click way to
 * move on. Plain (dashed) by default, because the consultant decides; solid teal when Edge
 * suggests a step, which can be the next one ("settled") or a jump ("already at offer").
 */
export function StepChip({ disabled }: { disabled?: boolean }) {
  const g = useGuide();
  if (!g.guide || !g.current) return null;
  const guide = g.guide;
  const idx = g.steps.findIndex((s) => s.key === guide.currentStep);
  const next = g.steps[idx + 1] ?? null;
  const done = guide.steps.find((s) => s.key === guide.currentStep)?.status === "done";
  const suggestion = guide.suggestion && guide.suggestion.toStep !== guide.currentStep ? guide.suggestion : null;
  const target = suggestion ? g.steps.find((s) => s.key === suggestion.toStep) ?? null : next;
  if (!target) return null;
  const isNext = target.key === next?.key;

  const label = isNext && !done ? `${STEP_SHORT_LABEL[guide.currentStep]} settled → ${STEP_SHORT_LABEL[target.key]}` : `${target.order < (g.current.order) ? "Back to" : "Move to"} ${STEP_SHORT_LABEL[target.key]}`;
  const go = () => {
    if (isNext && !done) void g.completeCurrent();
    else void g.moveTo(target.key);
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={go}
      title={suggestion ? `Edge suggests this: ${suggestion.reason}` : `Mark ${g.current.label} done and continue`}
      className={cn(
        "group inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[13px] leading-snug transition animate-fade-in-up focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
        suggestion ? "border-teal bg-teal-tint font-medium text-teal-foreground hover:bg-teal-tint/70 dark:text-teal" : "border-dashed border-teal/50 bg-card text-teal-foreground hover:border-teal hover:bg-teal-tint dark:text-teal",
      )}
    >
      {suggestion ? <Sparkles className="h-3.5 w-3.5 shrink-0" /> : <Check className="h-3.5 w-3.5 shrink-0" />}
      <span className="min-w-0">{label}</span>
    </button>
  );
}

/**
 * Edge's suggestion in words, under the chips: why it thinks the student can move on, and a
 * quiet way to say no. Nothing moves until the consultant clicks.
 */
export function SuggestionNote() {
  const g = useGuide();
  const s = g.guide?.suggestion;
  if (!g.guide || !s || s.toStep === g.guide.currentStep) return null;
  const target = g.steps.find((x) => x.key === s.toStep);
  if (!target) return null;
  return (
    <p className="mt-2.5 flex max-w-full items-start gap-1.5 text-[12.5px] leading-snug text-muted-foreground animate-fade-in-up">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-foreground dark:text-teal" aria-hidden />
      <span>
        <span className="font-medium text-foreground">Edge suggests {target.label}:</span> {s.reason}{" "}
        <button type="button" onClick={() => void g.update({ dismissSuggestion: true })} className="font-medium text-primary-strong underline-offset-2 hover:underline">
          Not yet
        </button>
      </span>
    </p>
  );
}
