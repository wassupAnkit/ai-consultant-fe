"use client";

import type { ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/use-chat";
import { useGuide } from "@/hooks/use-guide";
import { initials } from "@/lib/edge/journey";

/**
 * A guided session before its first question. It reads like the ordinary new-chat greeting,
 * just about one student: where their journey is, the box, and a few openers for this step.
 * An opener fills the box (never sends), so the consultant can make it their own.
 */
export function GuidedEmptyState({ children }: { children?: ReactNode }) {
  const g = useGuide();
  const { setDraft, activeSession } = useChat();
  const step = g.current;
  const name = g.student?.student?.name ?? activeSession?.title ?? "your student";
  const first = name.split(/\s+/)[0];

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-4 pb-10 pt-[8vh] sm:px-6 sm:pt-[12vh]">
      <div className="w-full max-w-[46rem]">
        <div className="mb-8 flex flex-col items-start gap-4 sm:mb-10">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal-tint text-sm font-semibold text-teal-foreground ring-1 ring-teal/30">{initials(name)}</span>
          <h1 className="font-heading text-greeting font-normal text-heading sm:text-greeting-lg">{step ? `${step.label}, with ${first}.` : `${first}'s journey.`}</h1>
          {step && <p className="max-w-xl text-body text-muted-foreground">{step.goal} Edge answers with {first}&rsquo;s CRM record to hand and tells you what&rsquo;s worth asking next.</p>}
        </div>

        {/* Where the CRM says the student already is. Edge proposes; the consultant starts there or not. */}
        {g.guide?.suggestion && g.guide.suggestion.toStep !== g.guide.currentStep && (
          <StartSuggestion toLabel={g.steps.find((x) => x.key === g.guide!.suggestion!.toStep)?.label ?? ""} reason={g.guide.suggestion.reason} onAccept={() => void g.moveTo(g.guide!.suggestion!.toStep)} onDismiss={() => void g.update({ dismissSuggestion: true })} />
        )}

        {children}

        {step && (
          <ul role="list" aria-label={`Ways to open ${step.label}`} className="mt-8 flex flex-wrap gap-2">
            {step.checklist.map((item) => (
              <li key={item} className="max-w-full">
                <button
                  type="button"
                  onClick={() => setDraft(item)}
                  className="inline-flex max-w-full items-center rounded-full border border-border bg-card px-3.5 py-1.5 text-left text-[13px] leading-snug text-foreground transition hover:border-primary/60 hover:bg-primary-tint hover:text-accent-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StartSuggestion({ toLabel, reason, onAccept, onDismiss }: { toLabel: string; reason: string; onAccept: () => void; onDismiss: () => void }) {
  return (
    <div className="mb-4 flex flex-col gap-2.5 rounded-xl border border-teal/40 bg-teal-tint/60 px-4 py-3 animate-fade-in-up sm:flex-row sm:items-center" role="status">
      <p className="flex min-w-0 flex-1 items-start gap-2 text-[13.5px] leading-snug text-foreground">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-teal-foreground dark:text-teal" aria-hidden />
        <span>
          {reason} <span className="font-medium">Start at {toLabel}?</span>
        </span>
      </p>
      <div className="flex shrink-0 gap-1.5 pl-6 sm:pl-0">
        <Button size="sm" variant="teal" onClick={onAccept}>
          Start there <ArrowRight />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          From the beginning
        </Button>
      </div>
    </div>
  );
}
