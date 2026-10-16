"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import { track } from "@/lib/analytics";

/**
 * Where the sidebar's conversation search box might be, most specific first. That input is
 * owned by the sidebar and is not always rendered — below `lg` the sidebar lives in a closed
 * sheet — so ⌘K falls back to the composer instead of doing nothing.
 */
const SEARCH_SELECTORS = ["[data-conversation-search]", "#conversation-search", 'nav input[type="search"]'];

function findSearchInput(): HTMLElement | null {
  for (const selector of SEARCH_SELECTORS) {
    const el = document.querySelector<HTMLElement>(selector);
    // An input inside a closed sheet is still in the DOM but cannot take focus.
    if (el && isVisible(el)) return el;
  }
  return null;
}

function isVisible(el: HTMLElement): boolean {
  const check = (el as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility;
  return typeof check === "function" ? check.call(el) : el.offsetParent !== null;
}

function isTextEntry(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA";
}

/**
 * ⌘ on Apple keyboards, Ctrl everywhere else. This is not only cosmetic: in macOS text
 * fields Ctrl+K is a real editing binding (delete to end of line), so binding Ctrl there
 * as well would break something people already use inside the composer.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

export interface ShortcutLabels {
  /** "⌘" or "Ctrl". */
  mod: string;
  /** "⇧" or "Shift". */
  shift: string;
}

/**
 * Key labels for the composer's hint line. Starts on the Ctrl/Shift spelling so the server
 * render and the first client render agree; the effect corrects it on Macs after mount.
 */
export function useShortcutLabels(): ShortcutLabels {
  const [apple, setApple] = useState(false);
  useEffect(() => setApple(isApplePlatform()), []);
  return apple ? { mod: "⌘", shift: "⇧" } : { mod: "Ctrl", shift: "Shift" };
}

export interface ChatShortcutOptions {
  /** The composer textarea: ⌘K's fallback target, and what Escape blurs. */
  composer: RefObject<HTMLTextAreaElement | null>;
  /** `stop` from `useChat`; only called while an answer is streaming. */
  stop: () => void;
  streaming: boolean;
}

/**
 * Workspace-wide keyboard shortcuts. Mounted once, from the composer — it is on every chat
 * route and already holds the textarea ref and `stop`, so nothing has to be lifted or
 * duplicated to reach them.
 *
 * Every shortcut except Escape carries ⌘/Ctrl, which typing cannot produce, so they stay
 * live inside text fields; a bare-key shortcut would have to be gated on `isTextEntry`.
 * Escape is the deliberate exception — stopping a runaway answer is exactly what people
 * reach for without taking their hands off the composer.
 */
export function useChatShortcuts({ composer, stop, streaming }: ChatShortcutOptions): void {
  const router = useRouter();
  // Read the moving parts through a ref so the listener binds once and never rebinds
  // between keydown and keyup as `streaming` flips.
  const latest = useRef({ stop, streaming });
  latest.current = { stop, streaming };

  useEffect(() => {
    const apple = isApplePlatform();

    const onKeyDown = (e: KeyboardEvent) => {
      // A keystroke choosing an IME candidate is not a shortcut.
      if (e.isComposing || e.keyCode === 229) return;

      if (e.key === "Escape") {
        // Radix owns Escape while one of its layers is open (delete dialog, mobile sheet);
        // stealing it there would stop the answer *and* close the dialog on one press.
        if (document.querySelector('[role="dialog"][data-state="open"]')) return;
        if (latest.current.streaming) {
          latest.current.stop();
          return;
        }
        // Not streaming: step out of the field so the next keypress isn't swallowed.
        const active = document.activeElement;
        if (isTextEntry(active)) active.blur();
        return;
      }

      if (!(apple ? e.metaKey : e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();

      if (key === "k" && !e.shiftKey) {
        e.preventDefault();
        (findSearchInput() ?? composer.current)?.focus();
        return;
      }

      if (key === "o" && e.shiftKey) {
        e.preventDefault();
        // Same navigation as the sidebar's "New chat" button; the route reset lives there.
        track("new_chat", { via: "shortcut" });
        router.push("/chat");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [composer, router]);
}
