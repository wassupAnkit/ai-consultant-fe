"use client";

import { useEffect, useState } from "react";
import { canEditProposal, draftsFrom, editedLines, editError, editsFromDrafts, formatValue, isDecidable, statusLabel } from "@/lib/edge/crm-writes";
import type { CrmWriteChange, CrmWriteEdits, CrmWriteProposalView, CrmWriteStatus } from "@/lib/edge/types";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** `crm_update_contact` -> "Update contact"; anything else falls back to stripping `crm_`. */
const TOOL_TITLE: Record<string, string> = {
  crm_update_contact: "Update contact",
  crm_update_enquiry: "Update enquiry",
  crm_create_enquiry: "Create enquiry",
  crm_update_office_visit: "Update office visit",
  crm_create_note: "Create note",
  crm_update_note: "Update note",
  crm_attach_contact_document: "Attach file",
};

function toolTitle(tool: string, entity?: string): string {
  if (TOOL_TITLE[tool]) return TOOL_TITLE[tool];
  if (entity === "document") return "Attach file";
  const stripped = tool.startsWith("crm_") ? tool.slice(4) : tool;
  return stripped
    .split("_")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

/** Text tone for the footer's status line once the card no longer offers Approve/Reject. */
export const STATUS_TONE: Record<CrmWriteStatus, string> = {
  pending: "text-muted-foreground",
  applying: "text-muted-foreground",
  applied: "text-success",
  rejected: "text-muted-foreground",
  expired: "text-warning-foreground",
  stale: "text-warning-foreground",
  failed: "text-destructive",
};

export interface ChangesTableProps {
  changes: CrmWriteChange[];
  valueOnly: boolean;
  caption?: string;
  /** Edit mode: each row's "after" is an input holding `drafts[field]`. */
  drafts?: Record<string, string>;
  onDraft?: (field: string, value: string) => void;
  disabled?: boolean;
}

export function ChangesTable({ changes, valueOnly, caption, drafts, onDraft, disabled }: ChangesTableProps) {
  return (
    <div className="space-y-1">
      {caption && <p className="text-xs font-medium text-muted-foreground">{caption}</p>}
      <div className="not-prose overflow-x-auto rounded-lg border border-border">
        <table className="my-0 w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
              <th className="px-3 py-1.5 font-medium">Field</th>
              <th className="px-3 py-1.5 font-medium">{valueOnly ? "Value" : "Before → after"}</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.field} className="border-b border-border last:border-0">
                <td className="px-3 py-1.5 align-top text-foreground">{c.label}</td>
                <td className="px-3 py-1.5 align-top text-foreground">
                  {drafts && onDraft ? (
                    <EditRow change={c} draft={drafts[c.field] ?? ""} onDraft={onDraft} disabled={disabled} />
                  ) : valueOnly ? (
                    formatValue(c.after)
                  ) : (
                    <>
                      <span className="text-muted-foreground">{formatValue(c.before)}</span>
                      <span className="mx-1 text-muted-foreground">→</span>
                      <span className="font-medium">{formatValue(c.after)}</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditRow({ change, draft, onDraft, disabled }: { change: CrmWriteChange; draft: string; onDraft: (field: string, value: string) => void; disabled?: boolean }) {
  const error = editError(change, draft);
  const id = `edit-${change.field}`;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground">{formatValue(change.before)} →</span>
      <Input
        id={id}
        value={draft}
        disabled={disabled}
        onChange={(e) => onDraft(change.field, e.target.value)}
        aria-label={`New ${change.label}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="(empty)"
        className={cn("h-8 bg-background text-[13px] md:text-[13px]", error && "border-destructive focus-visible:ring-destructive")}
      />
      {error && (
        <span id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * The current time, ticking every 30s. An approval card must cross its `expiresAt` without a
 * reload, so the buttons disappear on their own once the backend would refuse a decision anyway.
 */
export function useProposalClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export interface CrmWriteCardProps {
  view: CrmWriteProposalView;
  /** `edits`: values the counsellor changed on the card before approving (`crm_update_contact`). */
  onDecide: (decision: "approve" | "reject", edits?: CrmWriteEdits) => void;
}

/**
 * One card per `crm_write_proposal`: the exact before -> after the counsellor is approving,
 * rendered between the answer and its error box (`assistant-message.tsx`). No CRM write runs
 * until this card is approved -- teal marks it as CRM evidence/action, matching the citation
 * chip's use of teal for CRM sources (`citation-chip.tsx:44`).
 */
export function CrmWriteCard({ view, onDecide }: CrmWriteCardProps) {
  const now = useProposalClock();

  const isCreate = view.target.id === null;
  const applying = view.status === "applying";
  // Buttons stay mounted (disabled) through the optimistic "applying" hop, the same way
  // feedback-buttons.tsx keeps its icons in place while a click is in flight, rather than
  // swapping to text mid-click.
  const showButtons = isDecidable(view, now) || applying;
  // Edit: each "after" becomes an input; Approve then sends what changed. Cancel puts back the proposal.
  const [drafts, setDrafts] = useState<Record<string, string> | null>(null);
  const editing = drafts !== null && (canEditProposal(view, now) || applying);
  const invalid = editing && view.changes.some((c) => editError(c, drafts[c.field] ?? "") !== null);
  const edited = editedLines(view);

  const decide = (decision: "approve" | "reject") => {
    if (applying) return;
    const edits = decision === "approve" && editing ? editsFromDrafts(view.changes, drafts) : undefined;
    const hasEdits = Boolean(edits && Object.keys(edits).length);
    track("crm_write_decision", { proposalId: view.proposalId, requestId: view.requestId, tool: view.tool, decision, edited: hasEdits ? Object.keys(edits!).length : 0 });
    onDecide(decision, hasEdits ? edits : undefined);
  };

  return (
    <div className="not-prose my-3 max-w-xl overflow-hidden rounded-lg border border-teal/40 bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-teal-tint/40 px-3.5 py-2.5">
        <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-teal/40 bg-teal-tint px-2 text-[11px] font-semibold uppercase tracking-wide text-teal-foreground">
          CRM
        </span>
        <span className="text-sm font-medium text-foreground">{toolTitle(view.tool, view.target.entity)}</span>
        <span className="min-w-0 truncate text-sm text-muted-foreground">
          {view.target.label}
          {view.target.parentLabel ? ` · ${view.target.parentLabel}` : ""}
        </span>
      </div>

      <div className="space-y-3 px-3.5 py-3">
        <ChangesTable
          changes={view.changes}
          valueOnly={isCreate}
          caption={isCreate ? "New record" : editing ? "Change the new values, then approve" : undefined}
          drafts={editing ? drafts : undefined}
          onDraft={(field, value) => setDrafts((d) => ({ ...(d ?? {}), [field]: value }))}
          disabled={applying}
        />
        {edited.length > 0 && (
          <ul className="space-y-0.5 text-xs text-muted-foreground" aria-label="Your edits">
            {edited.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {view.status === "stale" && view.current && view.current.length > 0 && (
          <ChangesTable changes={view.current} valueOnly={false} caption="Current values in the CRM" />
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
        {showButtons ? (
          <>
            <Button type="button" variant="teal" size="sm" disabled={applying || invalid} onClick={() => decide("approve")}>
              Approve
            </Button>
            {editing ? (
              <Button type="button" variant="outline" size="sm" disabled={applying} onClick={() => setDrafts(null)}>
                Cancel
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" disabled={applying} onClick={() => decide("reject")}>
                  Reject
                </Button>
                {canEditProposal(view, now) && (
                  <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setDrafts(draftsFrom(view.changes))}>
                    Edit
                  </Button>
                )}
              </>
            )}
          </>
        ) : (
          <p aria-live="polite" className={cn("text-xs font-medium", STATUS_TONE[view.status])}>
            {statusLabel(view)}
          </p>
        )}
      </div>
    </div>
  );
}
