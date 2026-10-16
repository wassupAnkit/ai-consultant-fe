"use client";

/**
 * The in-app guide for counsellors.
 *
 * - First visit: a small prompt asks whether they would like the guide (animated slides, one
 *   per capability); "Ask me later" brings it back next visit, at most MAX_PROMPTS times.
 * - After a release with new features (TOUR_VERSION bump): the same prompt offers "What's new".
 * - Any time: the header's "?" button (HelpButton) opens the guide, the tour or what's new.
 *
 * The spotlight tour is driver.js over `data-tour="…"` attributes on the real controls. A step
 * whose control is not on screen (a docked panel on a narrow window, the starters inside a
 * conversation, a switched-off feature) is skipped rather than pointing at nothing.
 */
import "driver.js/dist/driver.css";
import "@/app/tour.css";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Driver } from "driver.js";
import { track } from "@/lib/analytics";
import { stepsFor, type TourFeatures, type TourId } from "@/lib/tour/content";
import { arrivalAction, markSeen, notePromptLater, readProgress } from "@/lib/tour/progress";
import { GuidePrompt, type PromptKind } from "./guide-prompt";
import { WelcomeGuide } from "./welcome-guide";

interface TourApi {
  openGuide: () => void;
  startTour: (id: TourId) => void;
}

const TourContext = createContext<TourApi>({ openGuide: () => {}, startTour: () => {} });

export function useTour(): TourApi {
  return useContext(TourContext);
}

/** Wait after arrival so the workspace (sessions, sidebar, fonts) has settled before anything opens. */
const ARRIVAL_DELAY_MS = 900;

export function TourProvider({ userId, features, children }: { userId: string; features: TourFeatures; children: ReactNode }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [prompt, setPrompt] = useState<PromptKind | null>(null);
  const active = useRef<Driver | null>(null);

  const startTour = useCallback(
    (id: TourId) => {
      setGuideOpen(false);
      setPrompt(null);
      // Let the guide's close animation finish so the spotlight measures the real layout.
      window.setTimeout(() => void runTour(id, features, userId, active), 260);
    },
    [features, userId],
  );

  const openGuide = useCallback(() => {
    active.current?.destroy();
    setPrompt(null);
    setGuideOpen(true);
    track("guide_opened", { via: "help" });
  }, []);

  useEffect(() => {
    const action = arrivalAction(readProgress(userId));
    if (!action) return;
    const t = window.setTimeout(() => {
      // Never on top of something the counsellor already opened.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      setPrompt(action);
      track("guide_prompted", { kind: action });
    }, ARRIVAL_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [userId]);

  useEffect(() => () => active.current?.destroy(), []);

  const api = useMemo(() => ({ openGuide, startTour }), [openGuide, startTour]);

  return (
    <TourContext.Provider value={api}>
      {children}
      {prompt && (
        <GuidePrompt
          kind={prompt}
          onYes={() => {
            track("guide_prompt_answer", { kind: prompt, answer: "yes" });
            if (prompt === "welcome") {
              setPrompt(null);
              setGuideOpen(true);
              track("guide_opened", { via: "prompt" });
            } else {
              startTour("whats-new");
            }
          }}
          onNo={() => {
            track("guide_prompt_answer", { kind: prompt, answer: "no" });
            markSeen(userId);
            setPrompt(null);
          }}
          onLater={() => {
            track("guide_prompt_answer", { kind: prompt, answer: "later" });
            notePromptLater(userId);
            setPrompt(null);
          }}
        />
      )}
      <WelcomeGuide
        open={guideOpen}
        features={features}
        onClose={(how) => {
          setGuideOpen(false);
          markSeen(userId);
          track(how === "finished" ? "guide_finished" : "guide_skipped", {});
        }}
        onStartTour={() => {
          markSeen(userId);
          track("guide_finished", { next: "tour" });
          startTour("basics");
        }}
      />
    </TourContext.Provider>
  );
}

/** The first rendered (non-hidden) element for a tour target, if any is on screen. */
export function findVisible(target: string, root: ParentNode = document): HTMLElement | null {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function runTour(id: TourId, features: TourFeatures, userId: string, active: { current: Driver | null }) {
  const steps = stepsFor(id, features)
    .map((s) => ({ s, el: findVisible(s.target) }))
    .filter((x): x is { s: (typeof x)["s"]; el: HTMLElement } => x.el !== null);
  if (!steps.length) {
    markSeen(userId);
    return;
  }
  const { driver } = await import("driver.js");
  active.current?.destroy();
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const total = steps.length;
  track("tour_started", { tour: id, steps: total });

  const d = driver({
    steps: steps.map(({ s, el }, i) => ({
      element: el,
      popover: {
        title: `<span class="edge-tour-step">${i + 1}</span>${escapeHtml(s.title)}`,
        description: escapeHtml(s.body),
        side: s.side,
        align: s.align ?? "center",
      },
    })),
    animate: !reduced,
    smoothScroll: !reduced,
    allowClose: true,
    overlayColor: "rgb(6, 50, 99)", // Expert navy
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 14,
    popoverOffset: 12,
    popoverClass: "edge-tour",
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: id === "basics" ? "Start using Edge" : "Got it",
    onHighlighted: (el) => el?.classList.add("edge-tour-active"),
    onDeselected: (el) => el?.classList.remove("edge-tour-active"),
    onDestroyStarted: () => {
      const finished = d.isLastStep();
      track(finished ? "tour_finished" : "tour_skipped", { tour: id, step: (d.getActiveIndex() ?? 0) + 1, of: total });
      markSeen(userId);
      document.querySelectorAll(".edge-tour-active").forEach((el) => el.classList.remove("edge-tour-active"));
      d.destroy();
      if (active.current === d) active.current = null;
    },
  });
  active.current = d;
  d.drive();
}

