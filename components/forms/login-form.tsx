"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { ExpertLockup } from "@/components/brand/expert-logo";
import { BRAND } from "@/lib/constants";

const HOME = "/chat";

export function LoginForm({ unconfigured = false, className, ...props }: React.ComponentPropsWithoutRef<"div"> & { unconfigured?: boolean }) {
  const params = useSearchParams();
  const requested = params.get("redirectedFrom") ?? HOME;
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : HOME;
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {/* The lockup repeats here for small screens, where the navy panel is not shown. */}
      <Link href="/" className="inline-flex w-fit items-center text-secondary lg:hidden dark:text-white" aria-label={`${BRAND.name} by ${BRAND.company}`}>
        <ExpertLockup className="h-9 w-auto" title={BRAND.company} />
      </Link>
      <div>
        <h1 className="font-heading text-[2rem] font-normal leading-tight tracking-[-0.01em] text-heading">Sign in to {BRAND.name}</h1>
        <p className="mt-2 text-body text-muted-foreground">Use your {BRAND.company} Google account to open the counsellor assistant.</p>
      </div>
      <GoogleSignInButton next={next} />
      {unconfigured && (
        <p className="rounded-lg border border-warning/50 bg-warning-tint px-3 py-2 text-xs leading-relaxed text-warning-foreground">
          Sign-in is not configured for this deployment. Ask an administrator to set <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> and <code className="font-mono">SESSION_SECRET</code>.
        </p>
      )}
    </div>
  );
}
