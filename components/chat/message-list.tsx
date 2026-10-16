"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useGuide } from "@/hooks/use-guide";
import type { ChatMessage, JourneyStepKey } from "@/lib/edge/types";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";

/** Scrolls with the stream while the reader is at the bottom; otherwise offers a jump button. */
export function MessageList() {
  const { messages } = useChat();
  const { steps } = useGuide();
  const dividers = stepDividers(messages);
  const scroller = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const lastContent = messages[messages.length - 1]?.content.length ?? 0;
  const lastStatus = messages[messages.length - 1]?.status;
  const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant")?.id ?? null;

  useEffect(() => {
    if (!atBottom || !scroller.current) return;
    scroller.current.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length, lastContent, lastStatus, atBottom]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  };

  return (
    <div className="relative h-full">
      {/* Bottom padding leaves room for the floating composer, which overlays this scroller. */}
      <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto px-4 pb-56 pt-8 sm:px-6">
        <ol className="mx-auto flex w-full max-w-[46rem] flex-col gap-8">
          {messages.map((m) => {
            const divider = dividers.get(m.id);
            const step = divider ? steps.find((s) => s.key === divider) : null;
            return (
              <li key={m.id} className="animate-fade-in-up">
                {step && (
                  <div className="mb-8 flex items-center gap-3" role="separator" aria-label={`Step ${step.order}: ${step.label}`}>
                    <span className="h-px flex-1 bg-border" />
                    <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Step {step.order} · {step.label}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                {m.role === "user" ? <UserMessage message={m} /> : <AssistantMessage message={m} isLastAnswer={m.id === lastAnswer} />}
              </li>
            );
          })}
        </ol>
      </div>
      {!atBottom && (
        <button
          type="button"
          onClick={() => {
            scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
            setAtBottom(true);
          }}
          className="absolute bottom-[8.5rem] left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-md transition hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <ArrowDown className="h-3.5 w-3.5" /> Latest
        </button>
      )}
    </div>
  );
}

/**
 * Where a guided thread changed step: the user message that opens each run of turns asked
 * at the same step. Stored history carries the step on the answer, so a question takes its
 * answer's step. The first run gets a divider only once a later run exists, so a thread that
 * never left its step shows none.
 */
function stepDividers(messages: ChatMessage[]): Map<string, JourneyStepKey> {
  const out = new Map<string, JourneyStepKey>();
  let prev: JourneyStepKey | null = null;
  let firstId: string | null = null;
  let firstStep: JourneyStepKey | null = null;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    if (m.role !== "user") continue;
    const step = m.guideStep ?? (messages[i + 1]?.role === "assistant" ? (messages[i + 1]!.guideStep ?? null) : null);
    if (!step) continue;
    if (prev === null) {
      firstId = m.id;
      firstStep = step;
    } else if (step !== prev) out.set(m.id, step);
    prev = step;
  }
  if (out.size && firstId && firstStep) out.set(firstId, firstStep);
  return out;
}
