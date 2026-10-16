import type { CrmWriteChange, CrmWriteEdits, CrmWriteProposalView, CrmWriteStatus, CrmWriteValue } from "./types";

/**
 * Pure reducer over `CrmWriteProposalView[]`. Folds the `crm_write_proposal` stream event and
 * the decision route's response into the list held on a chat message, and formats what the
 * approval card (`components/chat/crm-write-card.tsx`) shows. No component or browser test
 * setup exists in this repo, so this stays a plain module of pure functions over `bun:test`.
 */

/** Replace the proposal with this id in place, or append it; the list never reorders. */
export function upsertProposal(list: CrmWriteProposalView[] | undefined, view: CrmWriteProposalView): CrmWriteProposalView[] {
  const current = list ?? [];
  const index = current.findIndex((v) => v.proposalId === view.proposalId);
  if (index === -1) return [...current, view];
  const next = [...current];
  next[index] = view;
  return next;
}

/** Whether the card should still offer Approve/Reject: pending, and its deadline hasn't passed. */
export function isDecidable(view: CrmWriteProposalView, now: Date): boolean {
  return view.status === "pending" && now.getTime() < new Date(view.expiresAt).getTime();
}

/**
 * Client-side echo of the server's own rule: sending the next message expires the previous
 * turn's still-pending proposals. Flips every `pending` card to `expired` so the reader is
 * never shown Approve/Reject on a card the backend will refuse anyway.
 */
export function expireAll(list: CrmWriteProposalView[] | undefined, now: Date): CrmWriteProposalView[] | undefined {
  if (!list) return list;
  return list.map((v) => (v.status === "pending" ? { ...v, status: "expired" as const, decidedAt: now.toISOString() } : v));
}

const STATUS_TEXT: Record<Exclude<CrmWriteStatus, "failed">, string> = {
  pending: "Waiting for your approval",
  applying: "Applying…",
  applied: "Applied",
  rejected: "Rejected",
  expired: "Expired, not applied",
  stale: "Not applied: the record changed",
};

/** What the footer says once the card no longer offers Approve/Reject. */
export function statusLabel(view: CrmWriteProposalView): string {
  if (view.status === "failed") return `Failed: ${view.error ?? "unknown error"}`;
  return STATUS_TEXT[view.status];
}

/** `null` reads as "(empty)" rather than a blank cell; booleans read as words, not "true"/"false". */
export function formatValue(v: CrmWriteValue): string {
  if (v === null) return "(empty)";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

// --- Editable approval ---------------------------------------------------------

/** Tools whose change rows map 1:1 to tool arguments, so the backend accepts `edits` for them. */
export const EDITABLE_TOOLS = new Set(["crm_update_contact"]);

/** Whether the card offers Edit: an editable tool, still decidable, with something to edit. */
export function canEditProposal(view: CrmWriteProposalView, now: Date): boolean {
  return EDITABLE_TOOLS.has(view.tool) && isDecidable(view, now) && view.changes.length > 0;
}

/** The text each "after" input starts with: the proposed value, `null` as an empty box. */
export function draftsFrom(changes: CrmWriteChange[]): Record<string, string> {
  return Object.fromEntries(changes.map((c) => [c.field, c.after === null ? "" : typeof c.after === "boolean" ? (c.after ? "Yes" : "No") : String(c.after)]));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Read an input back as the proposed value's type: numbers and yes/no stay typed (empty is refused by `editError`). */
function coerce(draft: string, original: CrmWriteValue): CrmWriteValue {
  const text = draft.trim();
  if (!text) return null;
  if (typeof original === "number" && /^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if (typeof original === "boolean") {
    if (/^(yes|true)$/i.test(text)) return true;
    if (/^(no|false)$/i.test(text)) return false;
  }
  return text;
}

/** Why an edited value can't be sent, or null. Dates stay `YYYY-MM-DD`, as the CRM requires. */
export function editError(change: CrmWriteChange, draft: string): string | null {
  const text = draft.trim();
  // A document never clears a CRM field: to keep the CRM's value, reject the card instead.
  if (!text && change.after !== null) return "Can't be empty (reject the card to keep the CRM value)";
  if (text && typeof change.after === "string" && DATE_RE.test(change.after) && !DATE_RE.test(text)) return "Use YYYY-MM-DD";
  if (text && typeof change.after === "number" && !/^-?\d+(\.\d+)?$/.test(text)) return "Enter a number";
  if (text && typeof change.after === "boolean" && !/^(yes|no|true|false)$/i.test(text)) return "Yes or No";
  return null;
}

/** Only the rows the counsellor actually changed, keyed by field, as the decision's `edits`. */
export function editsFromDrafts(changes: CrmWriteChange[], drafts: Record<string, string>): CrmWriteEdits {
  const edits: CrmWriteEdits = {};
  for (const c of changes) {
    const draft = drafts[c.field];
    if (draft === undefined) continue;
    const value = coerce(draft, c.after);
    if (value !== c.after) edits[c.field] = value;
  }
  return edits;
}

/** After the decision: "You changed Passport number from PA1 to PA2", one line per edited field. */
export function editedLines(view: CrmWriteProposalView): string[] {
  return (view.edited ?? []).map((e) => {
    const label = view.changes.find((c) => c.field === e.field)?.label ?? e.field;
    return `You changed ${label} from ${formatValue(e.from)} to ${formatValue(e.to)}`;
  });
}
