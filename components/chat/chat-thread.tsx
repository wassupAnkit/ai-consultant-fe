"use client";

import { AlertTriangle } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useGuide } from "@/hooks/use-guide";
import { GuidedEmptyState } from "@/components/guided/guided-empty-state";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { MessageList } from "./message-list";

/**
 * The middle pane. With no messages the composer sits in the empty state under the greeting;
 * once a conversation exists it floats over the foot of the thread.
 */
export function ChatThread() {
  const { messages, status, loadError, setDraft } = useChat();
  const { guide } = useGuide();
  const showEmpty = messages.length === 0 && status !== "loading" && !loadError;

  if (showEmpty && guide) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <GuidedEmptyState>
          <Composer variant="hero" />
        </GuidedEmptyState>
      </div>
    );
  }

  if (showEmpty) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyState onPick={setDraft}>
          <Composer variant="hero" />
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        {status === "loading" && <ThreadSkeleton />}
        {loadError && (
          <div className="mx-auto mt-10 flex max-w-xl items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Could not load this conversation</p>
              <p className="text-muted-foreground">{loadError}</p>
            </div>
          </div>
        )}
        {status !== "loading" && !loadError && <MessageList />}
      </div>
      {/* Floats over the scroller; the list keeps enough bottom padding to scroll clear of it. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        <div className="pointer-events-auto">
          <Composer variant="docked" />
        </div>
      </div>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[46rem] space-y-8 px-4 pt-8">
      <div className="ml-auto h-10 w-2/3 animate-pulse rounded-2xl bg-primary-tint" />
      <div className="space-y-2.5">
        <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
