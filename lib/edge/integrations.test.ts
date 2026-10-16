import { describe, expect, test } from "bun:test";
import {
  callbackLocation,
  googleErrorLocation,
  integrationAction,
  integrationErrorMessage,
  integrationRows,
  integrationStatusText,
  isIntegrationService,
  readIntegrationParams,
  safeReturnTo,
  servicesPhrase,
  SERVICE_LABEL,
  withParam,
} from "./integrations";

describe("integration rows", () => {
  test("always lists Gmail then Drive, filling a missing service as not connected", () => {
    const rows = integrationRows([{ service: "drive", status: "connected", googleEmail: "a@heubert.com", connectedAt: "2026-09-30T00:00:00Z" }]);
    expect(rows.map((r) => [r.service, r.status])).toEqual([
      ["gmail", "not_connected"],
      ["drive", "connected"],
      ["calendar", "not_connected"],
      ["docs", "not_connected"],
    ]);
    expect(integrationRows(undefined).map((r) => r.service)).toEqual(["gmail", "drive", "calendar", "docs"]);
  });

  test("status text and action per status", () => {
    expect(integrationStatusText({ status: "connected", googleEmail: "a@heubert.com" })).toBe("Connected as a@heubert.com");
    expect(integrationStatusText({ status: "connected", googleEmail: null })).toBe("Connected");
    expect(integrationStatusText({ status: "not_connected", googleEmail: null })).toBe("Not connected");
    expect(integrationStatusText({ status: "reauth_required", googleEmail: "a@heubert.com" })).toBe("Reconnect needed");
    expect(integrationStatusText({ status: "error", googleEmail: null })).toBe("Unavailable");
    expect(integrationAction("connected")).toBe("disconnect");
    expect(integrationAction("not_connected")).toBe("connect");
    expect(integrationAction("reauth_required")).toBe("reconnect");
    expect(integrationAction("error")).toBe("reconnect");
  });

  test("labels for every service, and a list phrase for three or more", () => {
    expect(SERVICE_LABEL.calendar).toBe("Google Calendar");
    expect(SERVICE_LABEL.docs).toBe("Docs & Sheets");
    expect(servicesPhrase(["docs", "calendar", "gmail"])).toBe("Gmail, Google Calendar and Docs & Sheets");
    expect(readIntegrationParams("?connected=calendar,docs").toast?.message).toBe("Google Calendar and Docs & Sheets connected.");
  });

  test("service names", () => {
    expect(isIntegrationService("gmail")).toBe(true);
    expect(isIntegrationService("calendar")).toBe(true);
    expect(isIntegrationService("docs")).toBe(true);
    expect(isIntegrationService("sheets")).toBe(false);
    expect(isIntegrationService("toString")).toBe(false);
    expect(servicesPhrase(["drive", "gmail"])).toBe("Gmail and Google Drive");
    expect(servicesPhrase(["drive", "calendar", "chat"])).toBe("Google Drive and Google Calendar");
    expect(servicesPhrase([])).toBe("");
  });
});

describe("readIntegrationParams", () => {
  test("success toast names what was connected and strips only its own parameter", () => {
    expect(readIntegrationParams("?connected=gmail,drive&x=1")).toEqual({ found: true, toast: { kind: "success", message: "Gmail and Google Drive connected." }, rest: "x=1" });
    expect(readIntegrationParams("?connected=gmail").toast?.message).toBe("Gmail connected.");
  });

  test("error codes map to friendly messages", () => {
    expect(readIntegrationParams("?integrationError=account_mismatch").toast).toEqual({ kind: "error", message: "Connect the same Google work account you signed in with." });
    expect(integrationErrorMessage("scope_denied")).toContain("wasn't granted");
    expect(integrationErrorMessage("access_denied")).toBe("Connection cancelled.");
    expect(integrationErrorMessage("state_invalid")).toBe("Couldn't connect your Google account. Try again.");
  });

  test("nothing to do without the parameters; unknown services are dropped silently", () => {
    expect(readIntegrationParams("?q=fees")).toEqual({ found: false, toast: null, rest: "q=fees" });
    expect(readIntegrationParams("")).toEqual({ found: false, toast: null, rest: "" });
    expect(readIntegrationParams("?connected=chat")).toEqual({ found: true, toast: null, rest: "" });
  });
});

describe("callback redirect", () => {
  test("returns to where Connect was clicked with connected=<services>", () => {
    expect(callbackLocation(200, { services: ["gmail", "drive"], returnTo: "/chat/abc" })).toBe("/chat/abc?connected=gmail,drive");
    expect(callbackLocation(200, { services: ["drive"], returnTo: "/chat?tab=sources" })).toBe("/chat?tab=sources&connected=drive");
  });

  test("never redirects off-site", () => {
    for (const bad of ["https://evil.example/x", "//evil.example", "/\\evil.example", "chat", "", null, 42, "/\tx"]) {
      expect(safeReturnTo(bad)).toBe("/chat");
    }
    expect(callbackLocation(200, { services: ["gmail"], returnTo: "//evil.example/x" })).toBe("/chat?connected=gmail");
    expect(safeReturnTo("/chat/123")).toBe("/chat/123");
  });

  test("errors carry the backend's code, or a generic one", () => {
    expect(callbackLocation(400, { error: { code: "account_mismatch", message: "x" } })).toBe("/chat?integrationError=account_mismatch");
    expect(callbackLocation(502, { error: { code: "upstream_unreachable" } })).toBe("/chat?integrationError=upstream_unreachable");
    expect(callbackLocation(500, null)).toBe("/chat?integrationError=exchange_failed");
    expect(callbackLocation(400, { error: { code: "<script>" } })).toBe("/chat?integrationError=exchange_failed");
  });

  test("Google's own error: a refusal reads as cancelled", () => {
    expect(googleErrorLocation("access_denied")).toBe("/chat?integrationError=access_denied");
    expect(googleErrorLocation("invalid_scope")).toBe("/chat?integrationError=google_error");
    expect(withParam("/chat#x", "a", "b")).toBe("/chat?a=b#x");
  });
});
