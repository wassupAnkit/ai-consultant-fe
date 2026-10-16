"use client";

/** The header's "?" button: the feature guide, the spotlight tour and what's new, always one click away. */
import { CircleHelp, Compass, Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTour } from "./tour-provider";

export function HelpButton() {
  const tour = useTour();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Help and guide" title="Help and guide" data-tour="help">
          <CircleHelp />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Help</DropdownMenuLabel>
        <DropdownMenuItem onSelect={tour.openGuide} className="items-start gap-2.5">
          <Sparkles className="mt-0.5 text-primary" />
          <span>
            <span className="block text-sm font-medium">Feature guide</span>
            <span className="block text-xs text-muted-foreground">What Edge does, animated</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => tour.startTour("basics")} className="items-start gap-2.5">
          <Compass className="mt-0.5 text-primary" />
          <span>
            <span className="block text-sm font-medium">Take the tour</span>
            <span className="block text-xs text-muted-foreground">Walk through the screen, step by step</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => tour.startTour("whats-new")} className="items-start gap-2.5">
          <Gift className="mt-0.5 text-primary" />
          <span>
            <span className="block text-sm font-medium">What&apos;s new</span>
            <span className="block text-xs text-muted-foreground">The latest features</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
