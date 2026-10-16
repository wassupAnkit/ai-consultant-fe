import type { CrmWriteEdits } from "./types";

/**
 * Body checks shared by the /api proxy routes, kept pure so they are testable without Next's
 * request scope. Each returns `{ ok: false, message }` with the text the route sends as a 400.
 * The backend validates again; these only stop obviously malformed requests at the edge.
 */
export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Attachment ids a chat turn may carry (`attachments` on `POST /v1/chat/stream`). */
export const MAX_CHAT_ATTACHMENTS = 5;
/** Most fields a counsellor can edit on one approval card. */
export const MAX_EDIT_KEYS = 30;
const MAX_EDIT_KEY_CHARS = 100;
const MAX_EDIT_VALUE_CHARS = 2_000;

/** `attachments` on a chat request: absent, or at most 5 distinct uuids. */
export function parseAttachmentIds(raw: unknown): Parsed<string[] | undefined> {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (!Array.isArray(raw)) return { ok: false, message: "attachments must be an array of attachment ids" };
  if (raw.length > MAX_CHAT_ATTACHMENTS) return { ok: false, message: `at most ${MAX_CHAT_ATTACHMENTS} attachments per message` };
  if (!raw.every((id) => typeof id === "string" && UUID_RE.test(id))) return { ok: false, message: "each attachment id must be a UUID" };
  const ids = [...new Set(raw as string[])];
  return { ok: true, value: ids.length ? ids : undefined };
}

export interface DecisionBody {
  decision: "approve" | "reject";
  edits?: CrmWriteEdits;
}

/**
 * `POST /api/crm-writes/:id/decision`: `{ decision, edits? }`. `edits` is a flat object of
 * string/number/boolean/null, at most 30 keys, and only with `approve`. Which keys a proposal
 * accepts is the backend's to decide (it knows the proposal's fields).
 */
export function parseDecisionBody(raw: unknown): Parsed<DecisionBody> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, message: "body must be a JSON object" };
  const { decision, edits } = raw as { decision?: unknown; edits?: unknown };
  if (decision !== "approve" && decision !== "reject") return { ok: false, message: 'decision must be "approve" or "reject"' };
  if (edits === undefined) return { ok: true, value: { decision } };
  if (typeof edits !== "object" || edits === null || Array.isArray(edits)) return { ok: false, message: "edits must be an object" };
  if (decision !== "approve") return { ok: false, message: "edits are only allowed with approve" };
  const entries = Object.entries(edits as Record<string, unknown>);
  if (entries.length > MAX_EDIT_KEYS) return { ok: false, message: `edits may change at most ${MAX_EDIT_KEYS} fields` };
  const clean: CrmWriteEdits = {};
  for (const [key, value] of entries) {
    if (!key || key.length > MAX_EDIT_KEY_CHARS) return { ok: false, message: "edits has an invalid field name" };
    const t = typeof value;
    if (value !== null && t !== "string" && t !== "number" && t !== "boolean") return { ok: false, message: `edits.${key} must be a string, number, boolean or null` };
    if (t === "number" && !Number.isFinite(value)) return { ok: false, message: `edits.${key} must be a finite number` };
    if (t === "string" && (value as string).length > MAX_EDIT_VALUE_CHARS) return { ok: false, message: `edits.${key} is too long` };
    clean[key] = value as CrmWriteEdits[string];
  }
  return { ok: true, value: entries.length ? { decision, edits: clean } : { decision } };
}
