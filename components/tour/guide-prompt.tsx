"use client";

/**
 * The arrival prompt: asks a counsellor who has not seen the guide (or a returning one after new
 * features ship) whether they want it, instead of opening it on them. Non-blocking: the page
 * stays usable; "Ask me later" brings it back next visit, at most MAX_PROMPTS times.
 */
import { useRef } from "react";
import { CircleHelp, Sparkles, X } from "lucide-react";
import { ExpertMark } from "@/components/brand/expert-logo";

export type PromptKind = "welcome" | "whats-new";

const COPY: Record<PromptKind, { eyebrow: string; title: string; body: string; yes: string; no: string }> = {
  welcome: {
    eyebrow: "Welcome to Edge",
    title: "Would you like a quick guide?",
    body: "Two minutes, with animations: how Edge answers with sources, works with your students and the CRM, and reads passports and IDs.",
    yes: "Show me the guide",
    no: "No thanks",
  },
  "whats-new": {
    eyebrow: "New in Edge",
    title: "See what's new?",
    body: "Edge can now read passports and IDs, cites official government pages it checks every night, and flags figures it can't source.",
    yes: "Show me",
    no: "Got it",
  },
};

export function GuidePrompt({ kind, onYes, onNo, onLater }: { kind: PromptKind; onYes: () => void; onNo: () => void; onLater: () => void }) {
  const copy = COPY[kind];
  const yes = useRef<HTMLButtonElement>(null);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="edge-guide-prompt-title"
      // Escape inside the prompt = "Ask me later". Only here: Escape elsewhere stops an answer or closes a menu.
      onKeyDown={(e) => e.key === "Escape" && onLater()}
      className="edge-guide-prompt fixed inset-x-4 bottom-24 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px]"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border bg-popover p-5 text-popover-foreground shadow-lg">
        {/* A slow sheen across the top edge, so the card reads as new without shouting. */}
        <div className="edge-guide-prompt-sheen pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-teal to-primary" />
        <button type="button" onClick={onLater} aria-label="Ask me later" title="Ask me later" className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <span className="edge-guide-prompt-ring absolute -inset-1 rounded-full" />
            <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary-tint">
              <ExpertMark className="h-6 w-6" />
            </span>
            <Sparkles className="edge-guide-prompt-spark absolute -right-1 -top-1 h-4 w-4 text-teal" />
          </div>
          <div className="min-w-0 pr-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{copy.eyebrow}</p>
            <h2 id="edge-guide-prompt-title" className="mt-0.5 font-heading text-[18px] font-semibold leading-snug text-heading">
              {copy.title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{copy.body}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onNo} className="rounded-full px-3 py-2 text-[13px] font-medium text-muted-foreground transition hover:text-foreground">
            {copy.no}
          </button>
          <button
            ref={yes}
            type="button"
            onClick={onYes}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-cta transition hover:-translate-y-px hover:bg-primary-strong"
          >
            <Sparkles className="h-3.5 w-3.5" /> {copy.yes}
          </button>
        </div>
        <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-[11.5px] text-muted-foreground">
          <CircleHelp className="h-3.5 w-3.5" /> The guide is always one click away under the <span className="font-medium text-foreground">?</span> button.
        </p>
      </div>
    </div>
  );
}
