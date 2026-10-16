"use client";

import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

// Lazy so the markdown renderer (and the shiki/katex it drags in) stays off the critical
// path: the shell, session list and composer are interactive immediately, and the empty
// state -- the first thing anyone sees -- never loads it at all.
const Markdown = dynamic(() => import("./markdown"), { ssr: false });
import { AlertTriangle, BookOpen, Check, CircleAlert, Copy, Info, RotateCcw, ShieldAlert } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useSourcesPanel } from "@/hooks/use-sources-panel";
import { useGuide } from "@/hooks/use-guide";
import { StepChip, SuggestionNote } from "@/components/guided/journey-pill";
import { track } from "@/lib/analytics";
import { detectCallout, leadingText } from "@/lib/edge/callouts";
import { isGmailProposal } from "@/lib/edge/gmail-drafts";
import { isCalendarProposal, isGoogleFileProposal } from "@/lib/edge/workspace-proposals";
import { citationNumber, linkifyCitations } from "@/lib/edge/citations";
import type { ChatMessage, CrmWriteEdits } from "@/lib/edge/types";
import { formatLatency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CitationChip } from "./citation-chip";
import { CrmWriteCard } from "./crm-write-card";
import { DocumentCard } from "./document-card";
import { GmailDraftCard } from "./gmail-draft-card";
import { CalendarEventCard } from "./calendar-event-card";
import { GoogleFileCard } from "./google-file-card";
import { FeedbackButtons } from "./feedback-buttons";
import { FollowUps } from "./follow-ups";
import { IntentBadge } from "./intent-badge";
import { ReasoningTrace } from "./reasoning-trace";
import { EdgeMark } from "./chat-workspace";

/**
 * One answer: the reasoning trace above it, the answer as prose, the caveats the prompt asks
 * the model to write as their own paragraphs shown as callouts, then a quiet action row and
 * — on the newest answer — the follow-up chips.
 */
export function AssistantMessage({ message, isLastAnswer = false }: { message: ChatMessage; isLastAnswer?: boolean }) {
  const { retryLast, send, status, activeSessionId, decideCrmWrite } = useChat();
  const guided = Boolean(useGuide().guide);
  const panel = useSourcesPanel();
  const [copied, setCopied] = useState(false);
  const streaming = message.status === "streaming";
  const sources = useMemo(() => message.sources ?? [], [message.sources]);
  const isSelected = panel.selectedMessageId === message.id;

  const markdown = useMemo(() => linkifyCitations(message.content), [message.content]);

  const components = useMemo(
    () => ({
      a: ({ href, children }: { href?: string; children?: ReactNode }) => {
        const n = citationNumber(href);
        if (n !== null) {
          const source = sources.find((s) => s.n === n);
          return (
            <CitationChip
              n={n}
              source={source}
              selected={isSelected && panel.selectedN === n}
              onSelect={(num) => {
                track("source_click", { requestId: message.requestId ?? null, sessionId: activeSessionId, url: source?.url ?? null, n: num });
                panel.select(message.id, num);
              }}
            />
          );
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      },
      // The prompt asks for three kinds of caveat as their own paragraphs; those become callouts.
      p: ({ children }: { children?: ReactNode }) => {
        const callout = detectCallout(leadingText(children));
        if (!callout) return <p>{children}</p>;
        if (callout.kind === "basis") return <p className="!mt-2 text-[13px] text-muted-foreground">{children}</p>;
        const gap = callout.kind === "gap";
        return (
          <div role="note" className={cn("not-prose my-3 flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-[14px] leading-relaxed", gap ? "border-warning/50 bg-warning-tint text-warning-foreground" : "border-border bg-muted text-foreground")}>
            {gap ? <CircleAlert className="mt-[3px] h-4 w-4 shrink-0" aria-hidden /> : <Info className="mt-[3px] h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
            <p className="m-0 min-w-0 [&>strong]:font-semibold">{children}</p>
          </div>
        );
      },
      table: ({ children }: { children?: ReactNode }) => (
        <div className="not-prose my-3 overflow-x-auto rounded-lg border border-border">
          <table className="prose-edge my-0 w-full">{children}</table>
        </div>
      ),
    }),
    [sources, isSelected, panel, message.id, message.requestId, activeSessionId],
  );

  const regenerate = () => {
    track("regenerate", { requestId: message.requestId ?? null, sessionId: activeSessionId, chars: message.content.length });
    void retryLast();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      track("copy_answer", { requestId: message.requestId ?? null, sessionId: activeSessionId, chars: message.content.length });
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const research = message.research;
  const researchNote =
    !streaming && research && (research.budgetExceeded || research.error)
      ? research.error
        ? "A lookup failed part-way, so this answer may be missing evidence. Check the sources before advising."
        : "The research budget ran out before every lookup finished, so this answer may be incomplete."
      : null;

  return (
    <article className="group/answer flex gap-3">
      <EdgeMark className="mt-0.5 h-7 w-7 shrink-0" />
      <div className="min-w-0 flex-1">
        {/* One polite live region for the whole turn: the phase, then "answer ready", never each token. */}
        <p className="sr-only" aria-live="polite">
          {streaming ? "Edge is answering" : message.status === "done" ? `Answer ready${sources.length ? `, ${sources.length} sources` : ""}` : ""}
        </p>

        {/* Thoughts count on their own: a turn can reason at length and never call a tool,
            and without them that turn would stream its thought into a panel that never opens. */}
        {Boolean(message.reasoning?.length || message.stage || message.thoughts?.length) && (
          <ReasoningTrace steps={message.reasoning ?? []} stage={message.stage} running={streaming} elapsedMs={message.latencyMs} thoughts={message.thoughts} deepThink={message.deepThink} />
        )}

        {message.refused && (
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-warning/50 bg-warning-tint px-2 py-1 text-xs font-medium text-warning-foreground">
            <ShieldAlert className="h-3.5 w-3.5" /> Declined by the safety gate
          </p>
        )}

        {message.content ? (
          <div className={cn("prose prose-edge max-w-none dark:prose-invert", streaming && "streaming-caret")}>
            <Markdown mode={streaming ? "streaming" : "static"} controls={false} components={components}>
              {markdown}
            </Markdown>
          </div>
        ) : streaming && !message.reasoning?.length && !message.stage && !message.thoughts?.length ? (
          <ThinkingDots />
        ) : null}

        {/* What Edge read from each attached document, ahead of the CRM changes it proposes. */}
        {message.documents?.map((d) => <DocumentCard key={d.attachmentId} doc={d} />)}

        {/* Shown on every assistant message, not only the newest: a reopened thread must
            still show what was proposed and how it was decided. */}
        {message.crmWrites?.map((v) => {
          const onDecide = (decision: "approve" | "reject", edits?: CrmWriteEdits) => void decideCrmWrite(message.id, v.proposalId, decision, edits);
          if (isGmailProposal(v)) return <GmailDraftCard key={v.proposalId} view={v} onDecide={onDecide} />;
          if (isCalendarProposal(v)) return <CalendarEventCard key={v.proposalId} view={v} onDecide={onDecide} />;
          if (isGoogleFileProposal(v)) return <GoogleFileCard key={v.proposalId} view={v} onDecide={onDecide} />;
          // CRM writes, and any provider this build does not know yet.
          return <CrmWriteCard key={v.proposalId} view={v} onDecide={onDecide} />;
        })}

        {message.status === "error" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-foreground">{message.error ?? "Something went wrong."}</span>
            <button type="button" onClick={() => void retryLast()} disabled={status === "streaming"} className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary-strong hover:bg-accent disabled:opacity-50">
              <RotateCcw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        )}
        {message.status === "stopped" && <p className="mt-1.5 text-xs italic text-muted-foreground">Stopped before the answer finished.</p>}

        {researchNote && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/50 bg-warning-tint px-3 py-2 text-[13px] leading-snug text-warning-foreground">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{researchNote}</span>
          </p>
        )}

        {message.disclaimer && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-[13px] leading-snug text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{message.disclaimer}</span>
          </p>
        )}

        {!streaming && (message.content || sources.length > 0) && (
          <div
            className={cn(
              "mt-2 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-xs text-muted-foreground transition-opacity",
              // Quiet until the reader wants it: shown on hover, on focus, and always on touch screens.
              "opacity-0 focus-within:opacity-100 group-hover/answer:opacity-100 [@media(hover:none)]:opacity-100",
              isLastAnswer && "opacity-100",
            )}
          >
            <button type="button" onClick={copy} className="inline-flex h-7 items-center gap-1 rounded-md px-2 transition hover:bg-accent hover:text-accent-foreground" aria-label="Copy answer">
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {message.status === "done" && message.requestId && <FeedbackButtons requestId={message.requestId} traceId={message.traceId} sessionId={activeSessionId} />}
            {/* Only the final answer can be regenerated: re-asking from the middle of a thread
                would leave the stored history saying something the reader can no longer see.
                The error state has its own "Try again", so don't offer the same thing twice. */}
            {isLastAnswer && message.status !== "error" && (
              <button type="button" onClick={regenerate} disabled={status === "streaming"} className="inline-flex h-7 items-center gap-1 rounded-md px-2 transition hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50" aria-label="Regenerate answer">
                <RotateCcw className="h-3.5 w-3.5" /> Regenerate
              </button>
            )}
            {sources.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  track("sources_panel_open", { requestId: message.requestId ?? null, sessionId: activeSessionId, sources: sources.length });
                  panel.select(message.id, null);
                }}
                className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 transition hover:bg-accent hover:text-accent-foreground", isSelected && "bg-primary-tint text-primary-strong")}
              >
                <BookOpen className="h-3.5 w-3.5" /> {sources.length} source{sources.length === 1 ? "" : "s"}
              </button>
            )}
            <span className="ml-auto inline-flex items-center gap-2">
              {message.intent && <IntentBadge intent={message.intent} />}
              {message.latencyMs ? <span className="tabular-nums">{formatLatency(message.latencyMs)}</span> : null}
            </span>
          </div>
        )}

        {isLastAnswer && message.status === "done" && ((message.followUps?.length ?? 0) > 0 || guided) && (
          <FollowUps
            items={message.followUps ?? []}
            disabled={status !== "idle"}
            trailing={guided ? <StepChip disabled={status !== "idle"} /> : undefined}
            onPick={(q) => {
              track("follow_up_click", { requestId: message.requestId ?? null, sessionId: activeSessionId, chars: q.length });
              void send(q);
            }}
          />
        )}
        {isLastAnswer && message.status === "done" && guided && <SuggestionNote />}
      </div>
    </article>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-2 text-muted-foreground" aria-label="Edge is thinking">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary motion-reduce:animate-none" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}
