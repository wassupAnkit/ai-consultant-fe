import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "./session";

/**
 * Identity for server-side calls to the Edge backend (route handlers).
 * There is no anonymous identity: `getCaller()` returns null for anyone
 * without a valid, unexpired Google session cookie, and every proxy route
 * must treat null as unauthenticated.
 */
export interface Caller {
  /** Session token to forward as `Authorization: Bearer`. */
  bearer: string;
  /** Stable owner id for chat sessions/profile: the signed-in user's email. */
  ownerId: string;
  user: SessionUser;
}

export async function getCaller(): Promise<Caller | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const user = await verifySessionToken(token);
  if (!user || !token) return null;
  return { bearer: token, ownerId: user.email, user };
}

/** Headers for calling the backend from the server. */
export function backendHeaders(caller: Caller): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json", "x-user-id": caller.ownerId, authorization: `Bearer ${caller.bearer}` };
  if (process.env.EDGE_API_KEY) h["x-api-key"] = process.env.EDGE_API_KEY;
  return h;
}
