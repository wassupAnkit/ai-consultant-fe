"use client";

import type { ReactNode } from "react";
import { ExpertMark } from "@/components/brand/expert-logo";
import { STARTER_GROUPS, STARTER_PROMPTS } from "@/lib/constants";
import { useWorkspaceUser } from "./chat-workspace";

/** "Good morning" by the reader's clock; the serif greeting is the one place the product speaks first. */
function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * A new conversation: the greeting, the message box right under it, and starter prompts
 * grouped by the kind of work. Picking a starter fills the box rather than sending, so a
 * counsellor can swap in their own student, university or country first.
 */
export function EmptyState({ onPick, children }: { onPick: (prompt: string) => void; children?: ReactNode }) {
  const user = useWorkspaceUser();
  const first = user?.name?.split(/\s+/)[0];
  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-4 pb-10 pt-[8vh] sm:px-6 sm:pt-[12vh]">
      <div className="w-full max-w-[46rem]">
        <div className="mb-8 flex flex-col items-start gap-4 sm:mb-10">
          <ExpertMark className="h-10 w-10" />
          <h1 className="font-heading text-greeting font-normal text-heading sm:text-greeting-lg">
            {greeting()}
            {first ? `, ${first}.` : "."}
          </h1>
          <p className="max-w-xl text-body text-muted-foreground">Ask about a student, a programme, a visa rule or a cost — or have Edge draft the message. Every answer cites what it drew on.</p>
        </div>

        {children}

        <div className="mt-10 space-y-6" data-tour="starters">
          {STARTER_GROUPS.map((group) => {
            const items = STARTER_PROMPTS.filter((p) => p.group === group);
            if (!items.length) return null;
            return (
              <section key={group} aria-labelledby={`starters-${group}`}>
                <h2 id={`starters-${group}`} className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group}
                </h2>
                <ul role="list" className="flex flex-wrap gap-2">
                  {items.map((p) => (
                    <li key={p.title}>
                      <button
                        type="button"
                        onClick={() => onPick(p.prompt)}
                        title={p.prompt}
                        className="inline-flex h-9 items-center rounded-full border border-border bg-card px-3.5 text-[13px] font-medium text-foreground transition hover:border-primary/60 hover:bg-primary-tint hover:text-accent-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                      >
                        {p.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="mt-10 max-w-xl text-xs leading-relaxed text-muted-foreground">
          Edge reads this agency&rsquo;s CRM as you, so it only ever sees the students, deals and tasks you can. Answers cite numbered sources: teal ones are your CRM records, blue ones are indexed pages, live web pages and program records. Click a citation to read what it came from.
        </p>
      </div>
    </div>
  );
}
