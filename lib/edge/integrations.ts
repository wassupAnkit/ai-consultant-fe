import type { IntegrationService, IntegrationStatus, IntegrationView } from "./types";

/**
 * Pure helpers for the consultant's connected Google accounts: what the account menu says
 * for each service, the toast after Google's consent screen sends them back, and the
 * redirect the OAuth callback route issues. Kept free of React so `bun:test` covers them.
 */

export const INTEGRATION_SERVICES: readonly IntegrationService[] = ["gmail", "drive", "calendar", "docs"];

export const SERVICE_LABEL: Record<IntegrationService, string> = {
  gmail: "Gmail",
  drive: "Google Drive",
  calendar: "Google Calendar",
  docs: "Docs & Sheets",
};

export function isIntegrationService(value: unknown): value is IntegrationService {
  return typeof value === "string" && (INTEGRATION_SERVICES as readonly string[]).includes(value);
}

/** A row for every service, in menu order, even when the backend omits one. */
export function integrationRows(list: IntegrationView[] | undefined): IntegrationView[] {
  return INTEGRATION_SERVICES.map((service) => list?.find((v) => v.service === service) ?? { service, status: "not_connected" as const, googleEmail: null, connectedAt: null });
}

/** The status line under a service's name in the menu. */
export function integrationStatusText(view: Pick<IntegrationView, "status" | "googleEmail">): string {
  switch (view.status) {
    case "connected":
      return view.googleEmail ? `Connected as ${view.googleEmail}` : "Connected";
    case "reauth_required":
      return "Reconnect needed";
    case "error":
      return "Unavailable";
    default:
      return "Not connected";
  }
}

export type IntegrationAction = "connect" | "reconnect" | "disconnect";

/** What clicking a service's row does. A broken or expired connection is fixed by consenting again. */
export function integrationAction(status: IntegrationStatus): IntegrationAction {
  if (status === "connected") return "disconnect";
  if (status === "not_connected") return "connect";
  return "reconnect";
}

export const ACTION_LABEL: Record<IntegrationAction, string> = { connect: "Connect", reconnect: "Reconnect", disconnect: "Disconnect" };

/** "Gmail", "Gmail and Google Drive", "Gmail, Google Drive and Google Calendar": services in menu order, unknown names dropped. */
export function servicesPhrase(services: readonly string[]): string {
  const names = INTEGRATION_SERVICES.filter((s) => services.includes(s)).map((s) => SERVICE_LABEL[s]);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const ERROR_TEXT: Record<string, string> = {
  account_mismatch: "Connect the same Google work account you signed in with.",
  scope_denied: "Google access wasn't granted. Tick the permissions and try again.",
  access_denied: "Connection cancelled.",
};

export const GENERIC_INTEGRATION_ERROR = "Couldn't connect your Google account. Try again.";

export function integrationErrorMessage(code: string): string {
  return ERROR_TEXT[code] ?? GENERIC_INTEGRATION_ERROR;
}

export interface IntegrationToast {
  kind: "success" | "error";
  message: string;
}

/**
 * Read `?connected=gmail,drive` / `?integrationError=<code>` from a query string. Returns the
 * toast to show (or null) and the query string with both removed, so the caller can clean the
 * URL without a reload and a refresh never repeats the toast.
 */
export function readIntegrationParams(search: string): { found: boolean; toast: IntegrationToast | null; rest: string } {
  const params = new URLSearchParams(search);
  const connected = params.get("connected");
  const error = params.get("integrationError");
  if (connected === null && error === null) return { found: false, toast: null, rest: params.toString() };
  params.delete("connected");
  params.delete("integrationError");
  let toast: IntegrationToast | null = null;
  if (error !== null) {
    toast = { kind: "error", message: integrationErrorMessage(error) };
  } else if (connected) {
    const phrase = servicesPhrase(connected.split(","));
    if (phrase) toast = { kind: "success", message: `${phrase} connected.` };
  }
  return { found: true, toast, rest: params.toString() };
}

export const INTEGRATION_HOME = "/chat";

/** A same-origin path, or the chat home: never `//host`, `/\host` or an absolute URL. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return INTEGRATION_HOME;
  if (/[\u0000-\u001f\u007f]/.test(value)) return INTEGRATION_HOME;
  return value;
}

/** Set one query parameter on a relative path, keeping its other parameters and hash. */
export function withParam(path: string, key: string, value: string): string {
  const url = new URL(path, "http://edge.local");
  url.searchParams.set(key, value);
  // A comma is legal in a query string; keep `connected=gmail,drive` readable.
  return `${url.pathname}${url.search.replace(/%2C/gi, ",")}${url.hash}`;
}

/** Only codes that look like codes reach the URL; anything else reads as a generic failure. */
function errorCode(value: unknown): string {
  return typeof value === "string" && /^[a-z][a-z0-9_]{0,48}$/.test(value) ? value : "exchange_failed";
}

/**
 * Where the OAuth callback sends the browser, from the backend's answer to
 * `POST /v1/integrations/google/callback`: back to where Connect was clicked with
 * `connected=<services>`, or to the chat with `integrationError=<code>`.
 */
export function callbackLocation(status: number, body: unknown): string {
  const b = (body ?? {}) as { services?: unknown; returnTo?: unknown; error?: { code?: unknown } };
  if (status >= 200 && status < 300) {
    const services = Array.isArray(b.services) ? INTEGRATION_SERVICES.filter((s) => (b.services as unknown[]).includes(s)) : [];
    const target = safeReturnTo(b.returnTo);
    return services.length ? withParam(target, "connected", services.join(",")) : target;
  }
  return withParam(INTEGRATION_HOME, "integrationError", errorCode(b.error?.code));
}

/** Google's own `?error=` on the redirect: a refusal on the consent screen, or something else. */
export function googleErrorLocation(error: string): string {
  return withParam(INTEGRATION_HOME, "integrationError", error === "access_denied" ? "access_denied" : "google_error");
}
