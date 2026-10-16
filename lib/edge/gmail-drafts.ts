import { formatValue } from "./crm-writes";
import type { CrmWriteChange, CrmWriteProposalView, CrmWriteStatus } from "./types";

/**
 * Pure helpers for the Gmail draft card (`components/chat/gmail-draft-card.tsx`). A Gmail
 * draft arrives as an ordinary write proposal with `provider: "gmail"`; its `changes` are the
 * draft's fields (`before` is always null), which the card lays out as an email rather than
 * as a before -> after table. Approving saves a draft in the consultant's Gmail; nothing is sent.
 */

export function isGmailProposal(view: Pick<CrmWriteProposalView, "provider" | "target">): boolean {
  return view.provider === "gmail" || view.target.entity === "gmailDraft";
}

/** A change's value as display text; a list of addresses (should one arrive) reads comma-separated. */
function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    const parts = value.map((v) => text(v)).filter((v): v is string => Boolean(v));
    return parts.length ? parts.join(", ") : null;
  }
  const s = typeof value === "string" ? value : formatValue(value as CrmWriteChange["after"]);
  return s.trim() === "" ? null : s;
}

type Slot = "to" | "cc" | "bcc" | "subject" | "body" | "html" | "reply";

export interface DraftFields {
  to: string | null;
  cc: string | null;
  bcc: string | null;
  subject: string | null;
  /** The plain-text body; when the draft has only an HTML body, that body converted to text. */
  body: string | null;
  /** True when `body` came from the HTML body: the card says the email is formatted and shown as text. */
  bodyIsHtml: boolean;
  /** Set when the draft replies to an existing message or thread; the card says so rather than showing the id. */
  inReplyTo: string | null;
  /** Any field the card has no slot for (or a second value for a slot), shown as small rows beneath the body. */
  others: { field: string; label: string; value: string }[];
}

/** The backend's normalised labels (src/crm/approvals/service.ts `DRAFT_LABELS`), lower-cased. */
const BY_LABEL: Record<string, Slot> = {
  to: "to",
  cc: "cc",
  bcc: "bcc",
  subject: "subject",
  body: "body",
  "body (html)": "html",
  "in reply to message": "reply",
  "in reply to thread": "reply",
};

/** Older proposals, from before the labels were normalised: the backend's raw arg keys (`DRAFT_KEYS`). */
const BY_FIELD: Record<string, Slot> = {
  to: "to",
  recipient: "to",
  recipients: "to",
  cc: "cc",
  bcc: "bcc",
  subject: "subject",
  replytomessageid: "reply",
  inreplyto: "reply",
  threadid: "reply",
  body: "body",
  text: "body",
  plaintextbody: "body",
  content: "body",
  htmlbody: "html",
};

function slotOf(c: CrmWriteChange): Slot | undefined {
  return BY_LABEL[(c.label ?? "").trim().toLowerCase()] ?? BY_FIELD[c.field.toLowerCase().replace(/[_\-\s]/g, "")];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? "").trim() : null;
};

/** The backend's truncation marker on a long body; kept out of the markup so a cut-off tag cannot swallow it. */
const CAP_SUFFIX = /\n… \(\d+ more characters\)$/;

/**
 * An HTML body as plain text, for display only -- the card never renders the markup. Block
 * tags become line breaks, a link keeps its address beside its text and an image shows its
 * source, so nothing the email carries is hidden from the consultant approving it.
 */
export function htmlToText(html: string): string {
  const cap = CAP_SUFFIX.exec(html)?.[0] ?? "";
  let s = cap ? html.slice(0, -cap.length) : html;
  s = s
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(/<(script|style|head|title)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, "")
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (_m, attrs: string, inner: string) => {
      const href = attr(attrs, "href");
      return href ? `${inner} (${href})` : inner;
    })
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const src = attr(tag, "src");
      const alt = attr(tag, "alt");
      return `[image${alt ? `: ${alt}` : ""}${src ? ` ${src}` : ""}]`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|tr|table|blockquote|pre|ul|ol|section|article|header|footer)\s*>/gi, "\n")
    .replace(/<(p|div|h[1-6]|tr|table|blockquote|pre|ul|ol|section|article|header|footer|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/?[a-z!][^>]*(?:>|$)/gi, "");
  s = decodeEntities(s)
    .replace(/[ \t\u00a0]+\n/g, "\n")
    .replace(/\n[ \t\u00a0]+/g, "\n")
    .replace(/[ \t\u00a0]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s + cap;
}

/**
 * Pick the draft's fields out of a proposal's `changes`: by the backend's normalised `label`,
 * falling back to the raw arg name for older proposals. Nothing approved is dropped: extra
 * recipients join their line, a second subject or body (and the HTML body when a plain one
 * exists) becomes an extra row, and an HTML body is only ever turned into text.
 */
export function draftFields(changes: readonly CrmWriteChange[]): DraftFields {
  const slots = new Map<Slot, { c: CrmWriteChange; value: string }[]>();
  const others: DraftFields["others"] = [];
  for (const c of changes) {
    const raw = text(c.after);
    if (raw === null) continue;
    const slot = slotOf(c);
    const value = slot === "html" ? htmlToText(raw) : raw;
    if (!slot) others.push({ field: c.field, label: c.label || c.field, value });
    else slots.set(slot, [...(slots.get(slot) ?? []), { c, value }]);
  }

  const joined = (slot: Slot) => slots.get(slot)?.map((v) => v.value).join(", ") ?? null;
  /** The first value fills the slot; any further one is shown as its own row so it is still seen. */
  const first = (slot: Slot, rows: { c: CrmWriteChange; value: string }[] = slots.get(slot) ?? []) => {
    for (const { c, value } of rows.slice(1)) others.push({ field: c.field, label: c.label || c.field, value });
    return rows[0]?.value ?? null;
  };

  const subject = first("subject");
  const plain = slots.get("body") ?? [];
  const html = slots.get("html") ?? [];
  const bodyIsHtml = plain.length === 0 && html.length > 0;
  const body = bodyIsHtml ? first("html") : first("body");
  if (!bodyIsHtml) for (const { c, value } of html) others.push({ field: c.field, label: c.label || "Body (HTML)", value });

  return {
    to: joined("to"),
    cc: joined("cc"),
    bcc: joined("bcc"),
    subject,
    body,
    bodyIsHtml,
    inReplyTo: slots.get("reply")?.[0]?.value ?? null,
    others,
  };
}

const STATUS_TEXT: Record<Exclude<CrmWriteStatus, "failed">, string> = {
  pending: "Waiting for your approval",
  applying: "Saving draft…",
  applied: "Saved to Gmail Drafts",
  rejected: "Discarded, nothing saved",
  expired: "Expired, not saved",
  stale: "Not saved: the thread changed",
};

/** What the footer says once the card no longer offers Save draft / Discard. */
export function draftStatusLabel(view: Pick<CrmWriteProposalView, "status" | "error">): string {
  if (view.status === "failed") return `Not saved: ${view.error ?? "unknown error"}`;
  return STATUS_TEXT[view.status];
}

/** The applied draft's Gmail link, only when it is a real http(s) URL. */
export function draftLink(view: Pick<CrmWriteProposalView, "status" | "result">): string | null {
  if (view.status !== "applied") return null;
  const link = view.result?.link;
  return typeof link === "string" && /^https?:\/\//i.test(link) ? link : null;
}
