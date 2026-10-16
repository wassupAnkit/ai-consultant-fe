"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

/**
 * The backend's suggested next questions, as chips under the newest answer. Clicking one
 * asks it straight away — they are complete questions, written for the consultant, not
 * templates to edit.
 */
export function FollowUps({ items, onPick, disabled, trailing }: { items: string[]; onPick: (question: string) => void; disabled?: boolean; trailing?: ReactNode }) {
  if (!items.length && !trailing) return null;
  return (
    <ul role="list" aria-label="Suggested follow-up questions" className="mt-4 flex flex-wrap gap-2">
      {items.map((q, i) => (
        <li key={q} className="max-w-full animate-fade-in-up" style={{ animationDelay: `${i * 45}ms` }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(q)}
            className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-left text-[13px] leading-snug text-foreground transition hover:border-primary/60 hover:bg-primary-tint hover:text-accent-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="min-w-0">{q}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-primary" aria-hidden />
          </button>
        </li>
      ))}
      {trailing && <li className="max-w-full">{trailing}</li>}
    </ul>
  );
}
