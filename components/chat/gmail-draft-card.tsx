"use client";

import { CornerUpLeft, ExternalLink, Mail } from "lucide-react";
import { isDecidable } from "@/lib/edge/crm-writes";
import { draftFields, draftLink, draftStatusLabel } from "@/lib/edge/gmail-drafts";
import type { CrmWriteProposalView } from "@/lib/edge/types";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { STATUS_TONE, useProposalClock } from "./crm-write-card";

export interface GmailDraftCardProps {
  view: CrmWriteProposalView;
  onDecide: (decision: "approve" | "reject") => void;
}

function HeaderRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex gap-3 border-b border-border px-3 py-1.5 last:border-0">
      <dt className="w-14 shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 flex-1 break-words text-foreground", strong && "font-medium")}>{value}</dd>
    </div>
  );
}

/**
 * A `crm_write_proposal` with `provider: "gmail"`: an email Edge drafted, laid out as an email
 * so the consultant reads exactly what will land in their Drafts folder. Same decision flow as
 * `CrmWriteCard` -- nothing reaches Gmail until Save draft, and even then nothing is sent: the
 * consultant reviews and sends it from Gmail themselves. Navy marks the consultant's own Google
 * account, as it does for Gmail and Drive citations.
 */
export function GmailDraftCard({ view, onDecide }: GmailDraftCardProps) {
  const now = useProposalClock();
  const fields = draftFields(view.changes);
  const applying = view.status === "applying";
  const showButtons = isDecidable(view, now) || applying;
  const link = draftLink(view);

  const decide = (decision: "approve" | "reject") => {
    if (applying) return;
    track("crm_write_decision", { proposalId: view.proposalId, requestId: view.requestId, tool: view.tool, provider: "gmail", decision });
    onDecide(decision);
  };

  return (
    <div className="not-prose my-3 max-w-xl overflow-hidden rounded-lg border border-workspace/35 bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-workspace-tint/50 px-3.5 py-2.5">
        <Mail className="h-4 w-4 shrink-0 text-workspace-strong" aria-hidden />
        <span className="text-sm font-medium text-foreground">Gmail draft</span>
        {view.target.label && <span className="min-w-0 truncate text-sm text-muted-foreground">{view.target.label}</span>}
        <span className="ml-auto inline-flex h-5 shrink-0 items-center rounded-full border border-workspace/35 bg-workspace-tint px-2 text-[11px] font-semibold uppercase tracking-wide text-workspace-strong">
          Not sent
        </span>
      </div>

      <div className="space-y-2.5 px-3.5 py-3">
        <dl className="overflow-hidden rounded-lg border border-border text-[13px]">
          <HeaderRow label="To" value={fields.to ?? "(no recipient)"} />
          {fields.cc && <HeaderRow label="Cc" value={fields.cc} />}
          {fields.bcc && <HeaderRow label="Bcc" value={fields.bcc} />}
          <HeaderRow label="Subject" value={fields.subject ?? "(no subject)"} strong />
        </dl>

        {fields.inReplyTo && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CornerUpLeft className="h-3.5 w-3.5" aria-hidden /> Replies in the existing email thread
          </p>
        )}

        {fields.body && fields.bodyIsHtml && (
          <p className="text-xs text-muted-foreground">Formatted (HTML) email, shown here as plain text. Links and images show their address.</p>
        )}

        {fields.body ? (
          <div
            role="region"
            aria-label="Draft body"
            tabIndex={0}
            className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13.5px] leading-relaxed text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {fields.body}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">(empty body)</p>
        )}

        {fields.others.length > 0 && (
          <dl className="space-y-0.5 text-xs">
            {fields.others.map((o) => (
              <div key={o.field} className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">{o.label}</dt>
                <dd className="min-w-0 break-words text-foreground">{o.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3.5 py-2.5">
        {showButtons ? (
          <>
            <Button type="button" variant="workspace" size="sm" disabled={applying} onClick={() => decide("approve")}>
              Save draft
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={applying} onClick={() => decide("reject")}>
              Discard
            </Button>
            <p className="text-xs text-muted-foreground">Saves to your Gmail Drafts. Nothing is sent.</p>
          </>
        ) : (
          <>
            <p aria-live="polite" className={cn("text-xs font-medium", STATUS_TONE[view.status])}>
              {draftStatusLabel(view)}
            </p>
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary-strong hover:bg-accent">
                <ExternalLink className="h-3.5 w-3.5" /> Open in Gmail
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
