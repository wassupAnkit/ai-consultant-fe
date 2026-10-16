import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ExpertLockup } from "@/components/brand/expert-logo";
import { LoginForm } from "@/components/forms/login-form";
import { getCaller } from "@/lib/auth/server";
import { authMode } from "@/lib/auth/session";
import { BRAND } from "@/lib/constants";

export const dynamic = "force-dynamic";

const POINTS = ["Answers cite the page, record or document they came from.", "Reads your CRM as you — only the students, deals and tasks you can see.", "Covers the knowledge base, partner universities and live official pages."];

/** Homepage = sign-in. Counsellors land straight on "Continue with Google"; no separate marketing page. */
export default async function Home() {
  const mode = authMode();
  const caller = mode === "google" ? await getCaller() : null;
  if (caller?.user) redirect("/chat");

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-navy p-10 text-navy-foreground lg:flex xl:p-14" aria-label={`About ${BRAND.name}`}>
        <ExpertLockup className="h-9 w-auto text-white" title={BRAND.company} />
        <div className="max-w-md">
          <p className="font-heading text-[3.25rem] font-normal leading-none tracking-[-0.015em]">{BRAND.name}</p>
          <p className="mt-4 text-lg leading-relaxed text-white/80">{BRAND.company}&rsquo;s assistant for counsellors.</p>
          <ul className="mt-10 space-y-3 text-[15px] leading-relaxed text-white/75">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/50">Internal tool · {BRAND.company}</p>
        {/* The Expert overlap corner, as a quiet decoration in the bottom-right. */}
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-[0_120px_0_120px] bg-white/[0.06]" />
      </section>

      <div className="flex flex-col justify-center gap-4 p-6 md:p-10">
        <div className="mx-auto w-full max-w-sm">
          <Suspense fallback={null}>
            <LoginForm unconfigured={mode === "unconfigured"} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
