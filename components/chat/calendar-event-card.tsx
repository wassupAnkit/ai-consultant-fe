"use client";

import { CalendarDays, ExternalLink, MapPin, Send, Video } from "lucide-react";
import { isDecidable } from "@/lib/edge/crm-writes";
import { calendarFields, proposalLink, proposalStatusLabel, whenLabel } from "@/lib/edge/workspace-proposals";
import type { CrmWriteProposalView } from "@/lib/edge/types";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { STATUS_TONE, useProposalClock } from "./crm-write-card";

export interface CalendarEventCardProps {
  view: CrmWriteProposalView;
  onDecide: (decision: "approve" | "reject") => void;
}

/**
 * A `crm_write_proposal` with `provider: "calendar"`: an event Edge prepared for the consultant's
 * own Google Calendar. Nothing is created until Add to calendar. Approving is outward-facing when
 * there are attendees — Google emails each of them an invite at that moment — so the card names
 * them in an attention box before the buttons.
 */
export function CalendarEventCard({ view, onDecide }: CalendarEventCardProps) {
  const now = useProposalClock();
  const f = calendarFields(view.changes);
  const applying = view.status === "applying";
  const showButtons = isDecidable(view, now) || applying;
  const link = proposalLink(view);

  const decide = (decision: "approve" | "reject") => {
    if (applying) return;
    track("crm_write_decision", { proposalId: view.proposalId, requestId: view.requestId, tool: view.tool, provider: "calendar", decision });
    onDecide(decision);
  };

  return (
    <div className="not-prose my-3 max-w-xl overflow-hidden rounded-lg border border-workspace/35 bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-workspace-tint/50 px-3.5 py-2.5">
        <CalendarDays className="h-4 w-4 shrink-0 text-workspace-strong" aria-hidden />
        <span className="text-sm font-medium text-foreground">Calendar event</span>
        <span className="ml-auto inline-flex h-5 shrink-0 items-center rounded-full border border-workspace/35 bg-workspace-tint px-2 text-[11px] font-semibold uppercase tracking-wide text-workspace-strong">
          Not booked yet
        </span>
      </div>

      <div className="space-y-2.5 px-3.5 py-3 text-[13px]">
        <div>
          <p className="text-[15px] font-medium leading-snug text-foreground">{f.title ?? view.target.label}</p>
          <p className="mt-0.5 text-foreground">{whenLabel(f.starts, f.ends)}</p>
          {f.timeZone && <p className="text-xs text-muted-foreground">Time zone: {f.timeZone}</p>}
        </div>

        {(f.location || f.meet) && (
          <div className="space-y-1">
            {f.location && (
              <p className="flex items-center gap-1.5 text-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> {f.location}
              </p>
            )}
            {f.meet && (
              <p className="flex items-center gap-1.5 text-foreground">
                <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> Adds a Google Meet link
              </p>
            )}
          </div>
        )}

        {f.invites.length > 0 ? (
          <div role="note" className="flex gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
            <Send className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <p>
              <span className="font-medium">On Approve, Google emails an invite to:</span> <span className="break-words">{f.invites.join(", ")}</span>
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No attendees: nobody is invited.</p>
        )}

        {f.description && (
          <div
            role="region"
            aria-label="Event description"
            tabIndex={0}
            className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/40 px-3 py-2 leading-relaxed text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {f.description}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3.5 py-2.5">
        {showButtons ? (
          <>
            <Button type="button" variant="workspace" size="sm" disabled={applying} onClick={() => decide("approve")}>
              {f.invites.length ? "Add and send invites" : "Add to calendar"}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={applying} onClick={() => decide("reject")}>
              Discard
            </Button>
          </>
        ) : (
          <>
            <p aria-live="polite" className={cn("text-xs font-medium", STATUS_TONE[view.status])}>
              {proposalStatusLabel(view)}
            </p>
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary-strong hover:bg-accent">
                <ExternalLink className="h-3.5 w-3.5" /> Open in Google Calendar
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
