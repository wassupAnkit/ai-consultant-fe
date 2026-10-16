"use client";

import { useEffect, useState } from "react";

/**
 * Tracks browser connectivity so the UI can explain a failure and then recover on its own
 * when the connection comes back, rather than leaving a stale error on screen.
 *
 * Starts `true` deliberately: the server render has no `navigator`, and assuming online
 * keeps the offline indicator from flashing on every first paint. `navigator.onLine` only
 * proves the negative — false means there is definitely no network, true means there is a
 * link, not that Edge is reachable — so nothing is ever gated on it being true.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setOnline(navigator.onLine);
    update(); // The tab may already have been offline before this mounted.
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
