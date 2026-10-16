"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export interface FeedbackButtonsProps {
  /** Backend request id of the assistant turn (`done.requestId`). */
  requestId: string;
  traceId?: string | null;
  sessionId?: string | null;
  className?: string;
}

/**
 * Thumbs up / down for one assistant answer. Posts to `/api/feedback` (→ backend
 * `/v1/feedback`), which stores the score, sends it to Langfuse and labels the
 * recorded turn so it can be filtered when exporting fine-tuning data.
 * A thumbs-down opens an optional one-line "what was wrong?" field.
 */
export function FeedbackButtons({ requestId, traceId, sessionId, className = "" }: FeedbackButtonsProps) {
  const [score, setScore] = useState<1 | -1 | null>(null);
  const [busy, setBusy] = useState(false);
  const [askComment, setAskComment] = useState(false);
  const [comment, setComment] = useState("");
  const [commentSent, setCommentSent] = useState(false);

  const submit = async (value: 1 | -1, text?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId,
          traceId: traceId ?? undefined,
          sessionId: sessionId ?? undefined,
          score: value,
          comment: text?.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setScore(value);
      track("feedback_click", { requestId, sessionId: sessionId ?? undefined, score: value, hasComment: Boolean(text?.trim()) });
      if (text?.trim()) {
        setCommentSent(true);
        setAskComment(false);
        toast.success("Thanks, your note was sent.");
      } else if (value === -1) {
        setAskComment(true);
      } else {
        toast.success("Thanks for the feedback.");
      }
    } catch {
      toast.error("Could not send feedback. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-0.5 text-muted-foreground">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("h-7 w-7 rounded-md", score === 1 && "bg-success-tint text-success")}
          aria-label="Good answer"
          aria-pressed={score === 1}
          disabled={busy}
          onClick={() => submit(1)}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("h-7 w-7 rounded-md", score === -1 && "bg-destructive/10 text-destructive")}
          aria-label="Poor answer"
          aria-pressed={score === -1}
          disabled={busy}
          onClick={() => submit(-1)}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
        {score !== null && !askComment && <span className="ml-1 text-xs">{commentSent ? "Noted" : "Thanks"}</span>}
      </div>
      {askComment && score === -1 && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(-1, comment);
          }}
        >
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2_000}
            autoFocus
            placeholder="What was wrong? (optional)"
            aria-label="What was wrong with this answer?"
            className="h-8 flex-1 rounded-md border border-border bg-card px-2 text-xs focus:border-primary focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
          <Button type="submit" size="sm" variant="outline" className="h-8" disabled={busy || !comment.trim()}>
            Send
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" disabled={busy} onClick={() => setAskComment(false)}>
            Skip
          </Button>
        </form>
      )}
    </div>
  );
}
