"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string; auto_select?: boolean; hd?: string }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

/** "Continue with Google" via Google Identity Services; open to any verified Google account. */
export function GoogleSignInButton({ next = "/chat" }: { next?: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    const render = () => {
      if (!window.google || !holder.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setBusy(true);
          setError(null);
          const res = await fetch("/api/auth/google", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential }) });
          if (res.ok) {
            track("sign_in_success", { next });
            // A hard navigation (not the client router) guarantees the browser
            // actually leaves this page with the fresh session cookie applied,
            // even if dev-mode Fast Refresh or a stray re-render races a
            // client-side push right after it fires.
            window.location.assign(next);
          } else {
            const body = await res.json().catch(() => ({}));
            track("sign_in_error", { status: res.status, code: body.code ?? null });
            setError(body.error ?? "Sign-in failed");
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(holder.current, { theme: "outline", size: "large", width: 320, text: "continue_with", shape: "pill" });
    };
    if (window.google) render();
    else {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = render;
      document.head.appendChild(s);
    }
  }, [clientId, next]);

  if (!clientId) {
    return <p className="text-sm text-muted-foreground text-center">Sign-in is not configured for this deployment.</p>;
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={holder} />
      {busy && <p className="text-xs text-muted-foreground">Signing you in…</p>}
      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  );
}
