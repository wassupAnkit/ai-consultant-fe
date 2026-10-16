"use client";

/** Client-side identity helpers replacing supabase.auth.getUser() / signOut(). */
export interface CurrentUser {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { user: CurrentUser | null };
    return body.user;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
