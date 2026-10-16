import type { CrmWriteChange, CrmWriteProposalView } from "./types";

/**
 * Helpers for the two Google approval cards beside the Gmail draft: a Calendar event
 * (`provider: "calendar"`) and a new Google Doc or Sheet (`provider: "docs"`). The backend builds
 * their `changes` from the model's arguments with fixed labels
 * (src/crm/approvals/workspace-previews.ts); change both together.
 */

export const isCalendarProposal = (view: Pick<CrmWriteProposalView, "provider" | "target">): boolean =>
  view.provider === "calendar" || view.target.entity === "calendarEvent";

export const isGoogleFileProposal = (view: Pick<CrmWriteProposalView, "provider" | "target">): boolean =>
  view.provider === "docs" || view.target.entity === "googleDoc" || view.target.entity === "googleSheet";

const text = (v: CrmWriteChange["after"] | undefined): string | undefined => (v === null || v === undefined || v === "" ? undefined : String(v));
const byLabel = (changes: readonly CrmWriteChange[], label: string) => text(changes.find((c) => c.label === label)?.after);

export interface CalendarFields {
  title?: string;
  starts?: string;
  ends?: string;
  timeZone?: string;
  /** Who Google emails an invite to on Approve. */
  invites: string[];
  location?: string;
  meet: boolean;
  description?: string;
}

export function calendarFields(changes: readonly CrmWriteChange[]): CalendarFields {
  const invites = byLabel(changes, "Invites emailed to");
  return {
    title: byLabel(changes, "Title"),
    starts: byLabel(changes, "Starts"),
    ends: byLabel(changes, "Ends"),
    timeZone: byLabel(changes, "Time zone"),
    invites: invites ? invites.split(",").map((s) => s.trim()).filter(Boolean) : [],
    location: byLabel(changes, "Location"),
    meet: byLabel(changes, "Google Meet") === "Yes",
    description: byLabel(changes, "Description"),
  };
}

/** "Fri 2 Oct 2026, 15:00 – 15:30" when both ends fall on the same day, else both in full. */
export function whenLabel(starts?: string, ends?: string): string {
  if (!starts) return "(no time)";
  if (!ends) return starts;
  const [sDay, sTime] = starts.split(", ");
  const [eDay, eTime] = ends.split(", ");
  if (sDay === eDay && sTime && eTime) return `${sDay}, ${sTime} – ${eTime}`;
  return `${starts} – ${ends}`;
}

export interface FileFields {
  kind: "doc" | "sheet";
  title?: string;
  content?: string;
  rowsLabel?: string;
  tab?: string;
  /** The Sheet preview as a grid; the first row is the header. */
  rows: string[][];
}

/** A TSV preview (rows by \n, cells by \t) as a grid, at most `max` rows. */
export function parseTsv(tsv: string | undefined, max = 20): string[][] {
  if (!tsv) return [];
  return tsv
    .split("\n")
    .slice(0, max)
    .map((line) => line.split("\t"));
}

export function fileFields(view: Pick<CrmWriteProposalView, "changes" | "target">): FileFields {
  const type = byLabel(view.changes, "Type");
  const kind = type === "Google Sheet" || view.target.entity === "googleSheet" ? "sheet" : "doc";
  return {
    kind,
    title: byLabel(view.changes, "Title") ?? view.target.label,
    content: byLabel(view.changes, "Content"),
    rowsLabel: byLabel(view.changes, "Rows"),
    tab: byLabel(view.changes, "Sheet tab"),
    rows: parseTsv(byLabel(view.changes, "Preview")),
  };
}

const STATUS_TEXT: Record<CrmWriteProposalView["status"], string> = {
  pending: "Waiting for your approval",
  applying: "Creating…",
  applied: "Created",
  rejected: "Rejected — nothing was created",
  expired: "Expired — nothing was created",
  stale: "Expired — nothing was created",
  failed: "Not created",
};

export function proposalStatusLabel(view: Pick<CrmWriteProposalView, "status" | "error" | "provider">): string {
  if (view.status === "failed") return `Not created: ${view.error ?? "unknown error"}`;
  if (view.status === "applied" && view.provider === "calendar") return "Added to your calendar";
  return STATUS_TEXT[view.status];
}

const GOOGLE_HOSTS = /^(calendar|docs|drive)\.google\.com$/;

/** The created event's or file's link, only when it is an https link on Google's own hosts. */
export function proposalLink(view: Pick<CrmWriteProposalView, "status" | "result">): string | null {
  if (view.status !== "applied" || typeof view.result?.link !== "string") return null;
  try {
    const u = new URL(view.result.link);
    return u.protocol === "https:" && GOOGLE_HOSTS.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}
