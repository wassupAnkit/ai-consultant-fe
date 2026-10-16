import type { CrmContactMatch, CrmWriteEdits, CrmWriteProposalView, GuidePatch, IntegrationService, IntegrationsResponse, IntegrationView, JourneyStep, JourneyStepKey, KnowledgeSearchRequest, KnowledgeSearchResponse, SessionHistory, SessionSummary, StudentView } from "./types";

/** Error raised by the /api proxies; mirrors the backend's `{error:{code,message}}` envelope. */
export class EdgeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EdgeApiError";
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) }, cache: "no-store" });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = (body as { error?: string | { code?: string; message?: string } } | null)?.error;
    const message = typeof err === "string" ? err : err?.message ?? `HTTP ${res.status}`;
    const code = typeof err === "object" && err?.code ? err.code : `http_${res.status}`;
    throw new EdgeApiError(res.status, code, message);
  }
  return body as T;
}

/** Backend contract for the title on `PATCH /v1/sessions/:id` (trimmed, 1-120 chars). */
export const SESSION_TITLE_MAX = 120;

/** `pinned` is new; tolerate a backend that has not shipped it yet. */
function normalizeSession(s: SessionSummary): SessionSummary {
  return { ...s, pinned: s.pinned === true };
}

export async function listSessions(limit = 50): Promise<SessionSummary[]> {
  const body = await request<{ sessions: SessionSummary[]; count: number }>(`/api/sessions?limit=${limit}`);
  return body.sessions.map(normalizeSession);
}

export function getSession(id: string, signal?: AbortSignal): Promise<SessionHistory> {
  return request<SessionHistory>(`/api/sessions/${encodeURIComponent(id)}`, { signal });
}

/** Rename and/or pin a conversation. Returns the updated session. */
export async function updateSession(id: string, patch: { title?: string; pinned?: boolean }): Promise<SessionSummary> {
  const updated = await request<SessionSummary>(`/api/sessions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  return normalizeSession(updated);
}

export async function deleteSession(id: string): Promise<void> {
  await request<{ deleted: boolean }>(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function searchKnowledge(body: KnowledgeSearchRequest, signal?: AbortSignal): Promise<KnowledgeSearchResponse> {
  return request<KnowledgeSearchResponse>("/api/knowledge/search", { method: "POST", body: JSON.stringify(body), signal });
}

/**
 * Approve or reject a CRM write proposal (`POST /api/crm-writes/:id/decision`, proxying the
 * backend's `POST /v1/crm/writes/:id/decision`). A 409 means the proposal moved on before
 * this decision landed (already decided, expired, or gone stale) — the backend still returns
 * its current view in the body, so that resolves too instead of throwing; only a genuine
 * failure (404, network error, 5xx) throws `EdgeApiError`. `edits` (approve only) are the values
 * the counsellor changed on the card, keyed by `changes[].field`.
 */
export async function decideCrmWrite(proposalId: string, decision: "approve" | "reject", edits?: CrmWriteEdits): Promise<CrmWriteProposalView> {
  const res = await fetch(`/api/crm-writes/${encodeURIComponent(proposalId)}/decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(decision === "approve" && edits && Object.keys(edits).length ? { decision, edits } : { decision }),
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (res.ok || res.status === 409) return body as CrmWriteProposalView;
  const err = (body as { error?: string | { code?: string; message?: string } } | null)?.error;
  const message = typeof err === "string" ? err : err?.message ?? `HTTP ${res.status}`;
  const code = typeof err === "object" && err?.code ? err.code : `http_${res.status}`;
  throw new EdgeApiError(res.status, code, message);
}

// --- Guided journey sessions ---------------------------------------------------

type GuidedSession = SessionHistory["session"];

let journeyCache: Promise<JourneyStep[]> | null = null;

/** The ten journey steps. Static per deployment, so fetched once per page load. */
export function getJourney(): Promise<JourneyStep[]> {
  journeyCache ??= request<{ steps: JourneyStep[] }>("/api/journey")
    .then((b) => b.steps)
    .catch((err) => {
      journeyCache = null;
      throw err;
    });
  return journeyCache;
}

/** CRM contacts the signed-in consultant may see, for picking a guided session's student. */
export async function searchCrmContacts(query: string, signal?: AbortSignal): Promise<CrmContactMatch[]> {
  const body = await request<{ contacts: CrmContactMatch[] }>(`/api/crm/contacts?q=${encodeURIComponent(query)}&limit=10`, { signal });
  return body.contacts;
}

export async function createGuidedSession(contactId: string, step?: JourneyStepKey): Promise<GuidedSession> {
  const body = await request<{ session: GuidedSession }>("/api/sessions", { method: "POST", body: JSON.stringify({ guided: { contactId, ...(step ? { step } : {}) } }) });
  return body.session;
}

/** Move the journey, set step statuses, dismiss a suggestion, or convert a chat to guided. */
export async function patchGuide(sessionId: string, patch: GuidePatch): Promise<GuidedSession> {
  const body = await request<{ session: GuidedSession }>(`/api/sessions/${encodeURIComponent(sessionId)}/guide`, { method: "PATCH", body: JSON.stringify(patch) });
  return body.session;
}

/** The guided session's student, read live from the CRM (never stored by Edge). */
export function getStudent(sessionId: string, signal?: AbortSignal): Promise<StudentView> {
  return request<StudentView>(`/api/sessions/${encodeURIComponent(sessionId)}/student`, { signal });
}

// --- Connected Google accounts -------------------------------------------------

/** Gmail and Drive connection status for the signed-in consultant. */
export function listIntegrations(signal?: AbortSignal): Promise<IntegrationsResponse> {
  return request<IntegrationsResponse>("/api/integrations", { signal });
}

/**
 * Start Google's consent flow for these services. Returns the consent URL; the caller sends
 * the browser there, and `/api/integrations/google/callback` brings it back to `returnTo`.
 */
export async function connectGoogle(services: IntegrationService[], returnTo?: string): Promise<string> {
  const body = await request<{ url: string }>("/api/integrations/google/connect", { method: "POST", body: JSON.stringify({ services, ...(returnTo ? { returnTo } : {}) }) });
  return body.url;
}

/**
 * Revoke one service. Returns every service's status afterwards; `revoked: false` means Edge forgot the
 * grant but Google did not confirm revoking it (full disconnect only).
 */
export async function disconnectGoogle(service: IntegrationService): Promise<{ integrations: IntegrationView[]; revoked?: boolean }> {
  return request<{ integrations: IntegrationView[]; revoked?: boolean }>(`/api/integrations/google/${encodeURIComponent(service)}`, { method: "DELETE" });
}
