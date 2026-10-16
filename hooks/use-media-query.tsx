"use client";

import { useEffect, useState } from "react";

/**
 * Tracks a CSS media query in React state.
 *
 * Needed where a breakpoint has to change *behaviour*, not just styling: a Radix dialog
 * that is open but hidden with `xl:hidden` is still an open modal, so it traps focus and
 * clears pointer events on the body. Hiding it with CSS alone is not enough — it must not
 * open at all.
 *
 * Starts false so the server render and the first client render agree; the effect corrects
 * it before paint matters.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** True where the sources panel is docked in its own column rather than opened as a drawer. */
export function useSourcesDocked(): boolean {
  return useMediaQuery("(min-width: 1280px)"); // Tailwind `xl`
}
