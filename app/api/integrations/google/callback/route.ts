import { NextRequest } from "next/server";
import { callbackLocation, googleErrorLocation, INTEGRATION_HOME, withParam } from "@/lib/edge/integrations";
import { proxyJson } from "@/lib/edge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same place the middleware and `app/chat/layout.tsx` send a visitor without a session. */
const LOGIN = `/?redirectedFrom=${INTEGRATION_HOME}`;

/**
 * A relative `Location`: the browser resolves it against the address it actually used, so the
 * redirect is right behind the ingress whatever host the pod sees. 303 turns it into a GET.
 * No referrer, so the one-time `code` in this URL never leaks to the next page's requests.
 */
function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { location, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}

/**
 * Google's redirect target after the consent screen. Forwards `code` and `state` to
 * `POST /v1/integrations/google/callback` (which checks the state belongs to this caller and
 * exchanges the code), then sends the browser back to where Connect was clicked with
 * `?connected=gmail,drive`, or to the chat with `?integrationError=<code>` for the toast.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const googleError = params.get("error");
  if (googleError) return redirect(googleErrorLocation(googleError));

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return redirect(withParam(INTEGRATION_HOME, "integrationError", "state_invalid"));

  const upstream = await proxyJson(req, "/v1/integrations/google/callback", { method: "POST", body: { code, state } });
  // No session (expired while on Google's screen): sign in again, then Connect again -- the
  // state is bound to the account that started the flow, so it cannot be resumed.
  if (upstream.status === 401) return redirect(LOGIN);
  const body: unknown = await upstream.json().catch(() => null);
  return redirect(callbackLocation(upstream.status, body));
}
