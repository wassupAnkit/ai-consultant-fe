"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Slide-in drawer built on Radix Dialog; used for the sidebar and sources panel on small screens. */
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

type Side = "left" | "right" | "bottom";

const sideClasses: Record<Side, string> = {
  left: "inset-y-0 left-0 h-full w-[85vw] max-w-sm border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
  right: "inset-y-0 right-0 h-full w-[92vw] max-w-md border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  bottom: "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
};

function SheetContent({
  side = "left",
  className,
  overlayClassName,
  children,
  title,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: Side; title: string; overlayClassName?: string }) {
  return (
    <DialogPrimitive.Portal>
      {/* The overlay must carry the same responsive visibility as the panel. A sheet whose
          content is hidden at a breakpoint but whose overlay is not leaves the reader
          looking at a blurred screen with nothing on it. */}
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          overlayClassName,
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-background text-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out duration-300",
          sideClasses[side],
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <XIcon className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Sheet, SheetClose, SheetContent, SheetTrigger };
