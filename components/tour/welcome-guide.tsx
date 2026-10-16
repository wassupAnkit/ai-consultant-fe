"use client";

/**
 * The welcome guide: a short, animated walk through what Edge does for a counsellor, one slide
 * per capability. Arrow keys move between slides; the last slide offers the spotlight tour of
 * the real controls.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Compass, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { slidesFor, type TourFeatures } from "@/lib/tour/content";
import { cn } from "@/lib/utils";
import { Scene } from "./scenes";

export function WelcomeGuide({
  open,
  features,
  onClose,
  onStartTour,
}: {
  open: boolean;
  features: TourFeatures;
  onClose: (how: "finished" | "skipped") => void;
  onStartTour: () => void;
}) {
  const slides = slidesFor(features);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  // Bumped to replay the current scene from the start.
  const [replay, setReplay] = useState(0);
  const nextButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setDirection(1);
    }
  }, [open]);

  const go = (to: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, to));
    if (clamped === index) return;
    setDirection(clamped > index ? 1 : -1);
    setIndex(clamped);
  };

  const slide = slides[index]!;
  const last = index === slides.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose(last ? "finished" : "skipped")}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[760px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          nextButton.current?.focus();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          if (e.key === "ArrowLeft") go(index - 1);
        }}
      >
        <div className="grid md:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col justify-center p-4 pb-0 md:p-5 md:pr-0">
            <div key={`${slide.id}-${replay}`} className={cn("relative", direction === 1 ? "tour-slide-enter" : "tour-slide-enter-back")}>
              <Scene id={slide.id} />
              <button
                type="button"
                onClick={() => setReplay((r) => r + 1)}
                className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm ring-1 ring-border transition hover:text-foreground"
                aria-label="Replay this animation"
              >
                <RotateCcw className="h-3 w-3" /> Replay
              </button>
            </div>
          </div>

          <div className="flex flex-col p-5 md:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Feature guide · {index + 1} of {slides.length}
            </p>
            <div key={slide.id} className={cn("mt-2 flex-1", direction === 1 ? "tour-slide-enter" : "tour-slide-enter-back")}>
              <DialogTitle className="font-heading text-[22px] font-semibold leading-tight text-heading">{slide.title}</DialogTitle>
              <DialogDescription className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{slide.body}</DialogDescription>
              <ul className="mt-4 space-y-2">
                {slide.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-[13.5px] text-foreground">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-tint">
                      <Check className="h-2.5 w-2.5 text-primary-strong" strokeWidth={3} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            {/* Progress rail: one segment per slide, clickable. */}
            <div className="mt-6 flex gap-1.5" role="tablist" aria-label="Guide slides">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={s.label}
                  title={s.label}
                  onClick={() => go(i)}
                  className="group relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                >
                  <span
                    className={cn(
                      "absolute inset-0 origin-left rounded-full bg-primary transition-transform duration-500 ease-out",
                      i < index ? "scale-x-100" : i === index ? "scale-x-100 bg-gradient-to-r from-primary to-teal" : "scale-x-0",
                    )}
                  />
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              {index === 0 ? (
                <button type="button" onClick={() => onClose("skipped")} className="rounded-full px-3 py-2 text-[13px] font-medium text-muted-foreground transition hover:text-foreground">
                  Skip
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-[13px] font-medium text-foreground transition hover:border-primary/50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                {last ? (
                  <>
                    <button type="button" onClick={() => onClose("finished")} className="whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-medium text-muted-foreground transition hover:text-foreground">
                      Done
                    </button>
                    <button
                      ref={nextButton}
                      type="button"
                      onClick={onStartTour}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-cta transition hover:-translate-y-px hover:bg-primary-strong"
                    >
                      <Compass className="h-4 w-4" /> Show me around
                    </button>
                  </>
                ) : (
                  <button
                    ref={nextButton}
                    type="button"
                    onClick={() => go(index + 1)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-cta transition hover:-translate-y-px hover:bg-primary-strong"
                  >
                    Next <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
