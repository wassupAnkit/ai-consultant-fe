"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

/** Records a `ui.page_view` on every client-side navigation. Renders nothing. */
export function AnalyticsProvider() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    track("page_view", { referrer: document.referrer || null, title: document.title });
  }, [pathname]);
  return null;
}
