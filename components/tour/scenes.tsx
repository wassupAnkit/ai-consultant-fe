"use client";

/**
 * The welcome guide's animated scenes: one small, self-playing mock of each capability, built
 * from the app's own tokens so it reads as Edge in light and dark mode. Animations are CSS
 * (app/tour.css, `data-a` + `--d` delay); the guide remounts a scene to replay it, and under
 * prefers-reduced-motion every scene shows its finished state.
 */
import type { CSSProperties, ReactNode } from "react";
import {
  AlertCircle,
  Atom,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Landmark,
  Mail,
  Paperclip,
  Pencil,
  ScanLine,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import { ExpertMark } from "@/components/brand/expert-logo";
import type { SceneId } from "@/lib/tour/content";
import { cn } from "@/lib/utils";

type Anim = "up" | "pop" | "left" | "right" | "fade" | "type" | "fill" | "strike" | "scan" | "pulse" | "orbit" | "counter-orbit" | "float" | "caret" | "press";

/** Animation props: `a("pop", 0.4)` → data-a + a CSS delay (and an optional duration). */
function a(anim: Anim, delay = 0, extra: Record<string, string> = {}): { "data-a": Anim; style: CSSProperties } {
  return { "data-a": anim, style: { "--d": `${delay}s`, ...extra } as CSSProperties };
}

export function Scene({ id }: { id: SceneId }) {
  const Body = SCENES[id];
  return (
    <div
      className="tour-scene relative h-[236px] w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary-tint/70 via-card to-teal-tint/50 dark:from-primary/10 dark:via-card dark:to-teal/10"
      aria-hidden
    >
      {/* Soft dotted backdrop, the same on every scene. */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:14px_14px]" />
      <div className="relative h-full p-4">
        <Body />
      </div>
    </div>
  );
}

function Window({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-border bg-card/95 shadow-md backdrop-blur", className)}>{children}</div>;
}

function Line({ w, className, ...rest }: { w: string; className?: string } & Partial<ReturnType<typeof a>>) {
  return <div {...rest} className={cn("h-2 rounded-full bg-muted-foreground/20", className)} style={{ width: w, ...(rest.style ?? {}) }} />;
}

function Cite({ n, delay }: { n: number; delay: number }) {
  return (
    <span {...a("pop", delay)} className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-tint px-1 text-[9px] font-bold text-primary-strong">
      {n}
    </span>
  );
}

/* ---------- 1. Welcome: Edge at the centre of everything a counsellor touches ---------- */

const ORBIT = [
  { icon: Landmark, label: "Visas" },
  { icon: GraduationCap, label: "Courses" },
  { icon: Wallet, label: "Costs" },
  { icon: UserRound, label: "CRM" },
  { icon: FileText, label: "Documents" },
  { icon: Mail, label: "Gmail" },
];

function WelcomeScene() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative h-[200px] w-[200px]">
        <div {...a("pop", 0.1)} className="absolute inset-[62px] flex items-center justify-center rounded-full bg-card shadow-lg ring-1 ring-border">
          <span {...a("pulse", 0.8)} className="absolute inset-0 rounded-full" />
          <ExpertMark className="h-10 w-10" />
        </div>
        <div className="absolute inset-0 rounded-full border border-dashed border-primary/30" />
        <div {...a("orbit")} className="absolute inset-0">
          {ORBIT.map(({ icon: Icon, label }, i) => {
            const angle = (i / ORBIT.length) * 2 * Math.PI;
            return (
              <div key={label} className="absolute" style={{ left: `${50 + 50 * Math.cos(angle)}%`, top: `${50 + 50 * Math.sin(angle)}%`, transform: "translate(-50%, -50%)" }}>
                <div {...a("counter-orbit")}>
                  <span {...a("pop", 0.3 + i * 0.12)} className="flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-card px-2 py-1 text-[10px] font-semibold text-foreground shadow-sm">
                    <Icon className="h-3 w-3 text-primary" />
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- 2. Cited answers ---------- */

function AnswersScene() {
  return (
    <div className="flex h-full gap-3">
      <Window className="flex-1 space-y-2 p-3">
        <div {...a("left", 0)} className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-primary px-3 py-1.5 text-[10.5px] font-medium text-primary-foreground">
          Student visa: what funds must Sita show?
        </div>
        <div className="space-y-1">
          <div {...a("type", 0.6, { "--t": "0.9s" })} className="text-[10.5px] text-foreground">
            Living costs set by Home Affairs<Cite n={1} delay={1.5} />
          </div>
          <div {...a("type", 1.6, { "--t": "0.9s" })} className="text-[10.5px] text-foreground">
            plus year-one tuition and travel<Cite n={2} delay={2.5} />
          </div>
          <div {...a("type", 2.6, { "--t": "0.9s" })} className="text-[10.5px] text-foreground">
            Sponsor bank and income proof<Cite n={3} delay={3.5} />
          </div>
        </div>
        <div {...a("pop", 3.9)} className="inline-flex items-center gap-1 rounded-full bg-success-tint px-2 py-0.5 text-[9.5px] font-semibold text-success">
          <ShieldCheck className="h-3 w-3" /> Figures checked against sources
        </div>
      </Window>
      <Window className="hidden w-[150px] shrink-0 p-2.5 sm:block" {...a("left", 1.0)}>
        <div className="mb-2 flex items-center gap-1 text-[10px] font-semibold text-heading">
          <BookOpen className="h-3 w-3" /> Sources
        </div>
        {[
          { n: 1, t: "immi.homeaffairs.gov.au", k: "Official" },
          { n: 2, t: "Partner: university fees", k: "Partner" },
          { n: 3, t: "Nepal market guide", k: "Expert" },
        ].map((s, i) => (
          <div key={s.n} {...a("up", 1.6 + i * 0.9)} className="mb-1.5 rounded-lg border border-border bg-background p-1.5">
            <div className="flex items-center gap-1 text-[9px] font-semibold text-foreground">
              <span className="rounded bg-primary-tint px-1 text-primary-strong">{s.n}</span>
              <span className="truncate">{s.t}</span>
            </div>
            <div className="mt-0.5 text-[8.5px] text-muted-foreground">{s.k} · read last night</div>
          </div>
        ))}
      </Window>
    </div>
  );
}

/* ---------- 3. Student journey ---------- */

/** The real journey's ten steps (lib/edge/types.ts JourneyStepKey), labelled as the journey pill does. */
const STEPS = ["Enquiry", "Destination", "Course", "Institution", "Eligibility", "English", "Application", "Finances", "Visa", "Pre-departure"];
const CURRENT = 4; // Eligibility

function JourneyScene() {
  return (
    <div className="flex h-full flex-col justify-between">
      <Window className="flex items-center gap-2 px-3 py-2">
        <span className="text-[11px] text-muted-foreground">
          <span {...a("type", 0.2, { "--t": "0.5s" })} className="inline-block">@Aay</span>
          <span {...a("caret")} className="ml-px inline-block h-3 w-px translate-y-0.5 bg-foreground" />
        </span>
        <span {...a("pop", 1.0)} className="ml-auto inline-flex items-center gap-1 rounded-full bg-teal-tint px-2 py-0.5 text-[10px] font-semibold text-teal-foreground">
          <UserRound className="h-3 w-3" /> Aayush Poudel
        </span>
      </Window>

      <Window className="p-3" {...a("up", 1.4)}>
        <div className="mb-2.5 flex items-center justify-between text-[10px]">
          <span className="font-semibold text-heading">Aayush&apos;s journey</span>
          <span {...a("fade", 2.8)} className="rounded-full bg-primary-tint px-1.5 py-0.5 font-semibold text-primary-strong">
            Step {CURRENT + 1} of {STEPS.length} · {STEPS[CURRENT]}
          </span>
        </div>
        <div className="relative flex items-center justify-between">
          <div className="absolute inset-x-1 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
          <div {...a("fill", 1.7, { "--t": "1.1s" })} className="absolute left-1 top-1/2 h-1 w-[45%] -translate-y-1/2 origin-left rounded-full bg-gradient-to-r from-primary to-teal" />
          {STEPS.map((s, i) => (
            <span
              key={s}
              title={s}
              {...a("pop", 1.7 + i * 0.12)}
              className={cn(
                "relative h-2.5 w-2.5 rounded-full ring-2 ring-card",
                i < CURRENT ? "bg-primary" : i === CURRENT ? "bg-teal" : "bg-muted-foreground/25",
              )}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[8.5px] text-muted-foreground">
          <span>{STEPS[0]}</span>
          <span {...a("fade", 2.8)} className="font-semibold text-foreground">{STEPS[CURRENT]}</span>
          <span>{STEPS[STEPS.length - 1]}</span>
        </div>
      </Window>

      <div {...a("up", 3.1)} className="flex items-center gap-2 self-start rounded-xl border border-primary/30 bg-card px-3 py-2 shadow-sm">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10.5px] text-foreground">Next: confirm English test scores for the course</span>
      </div>
    </div>
  );
}

/* ---------- 4. CRM approval card ---------- */

function CrmScene() {
  const rows = [
    { f: "Passport no.", b: "—", after: "PX0012345" },
    { f: "Passport expiry", b: "2032-12-28", after: "2032-04-15" },
    { f: "Gender", b: "—", after: "Female" },
  ];
  return (
    <div className="flex h-full items-center justify-center">
      <Window className="w-full max-w-[380px] p-3" {...a("up", 0.1)}>
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-tint">
            <UserRound className="h-3.5 w-3.5 text-teal-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-heading">Update contact · Sita Shrestha</div>
            <div className="text-[9px] text-muted-foreground">Waiting for your approval</div>
          </div>
        </div>
        <div className="space-y-1">
          {rows.map((r, i) => (
            <div key={r.f} {...a("right", 0.5 + i * 0.35)} className="grid grid-cols-[92px_1fr_auto_1fr] items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-[9.5px]">
              <span className="text-muted-foreground">{r.f}</span>
              <span {...a("strike", 1.0 + i * 0.35)} className="truncate text-muted-foreground line-through">
                {r.b}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="truncate font-semibold text-foreground">{r.after}</span>
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center justify-end gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[9.5px] text-muted-foreground">
            <Pencil className="h-2.5 w-2.5" /> Edit
          </span>
          <span className="rounded-full border border-border px-2 py-0.5 text-[9.5px] text-muted-foreground">Reject</span>
          <span className="relative">
            <span {...a("pulse", 1.8)} className="absolute inset-0 rounded-full" />
            <span {...a("press", 2.9)} className="relative inline-flex rounded-full bg-primary px-2.5 py-0.5 text-[9.5px] font-semibold text-primary-foreground">
              Approve
            </span>
          </span>
        </div>
        <div {...a("pop", 3.3)} className="mt-2 flex items-center gap-1 text-[9.5px] font-semibold text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Applied to the CRM · audited
        </div>
      </Window>
    </div>
  );
}

/* ---------- 5. Documents ---------- */

function DocumentsScene() {
  const fields = [
    ["Name", "Sita Kumari Shrestha"],
    ["Date of birth", "2001-02-03"],
    ["Passport no.", "PX0012345"],
    ["Expiry", "2032-04-15"],
  ];
  return (
    <div className="flex h-full gap-3">
      <div {...a("right", 0)} className="relative w-[44%] shrink-0 overflow-hidden rounded-xl border border-border bg-gradient-to-b from-navy/90 to-navy p-2.5 text-white shadow-md">
        <div className="mb-1.5 flex items-center justify-between text-[8px] font-semibold uppercase tracking-wider text-white/80">
          <span>Passport</span>
          <span>Nepal</span>
        </div>
        <div className="flex gap-2">
          <div className="h-12 w-10 rounded-md bg-white/25" />
          <div className="flex-1 space-y-1 pt-0.5">
            <div className="h-1.5 w-[80%] rounded bg-white/50" />
            <div className="h-1.5 w-[60%] rounded bg-white/40" />
            <div className="h-1.5 w-[70%] rounded bg-white/40" />
            <div className="h-1.5 w-[45%] rounded bg-white/30" />
          </div>
        </div>
        <div className="mt-2 rounded bg-white/90 px-1 py-0.5 font-mono text-[6.5px] leading-tight text-navy">
          P&lt;NPLSHRESTHA&lt;&lt;SITA&lt;KUMARI&lt;&lt;&lt;&lt;
          <br />
          PX00123454NPL0102035F3204151&lt;&lt;&lt;
        </div>
        <div {...a("scan", 0.3, { "--h": "130px" })} className="pointer-events-none absolute inset-x-0 top-2 h-6 bg-gradient-to-b from-transparent via-teal/60 to-transparent" />
        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded bg-black/30 px-1 text-[7.5px]">
          <ScanLine className="h-2.5 w-2.5" /> reading
        </div>
      </div>
      <Window className="flex-1 p-2.5">
        <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-heading">
          <Paperclip className="h-3 w-3" /> passport.png
        </div>
        <div className="space-y-1">
          {fields.map(([k, v], i) => (
            <div key={k} {...a("left", 0.8 + i * 0.45)} className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2 py-1 text-[9.5px]">
              <span className="text-muted-foreground">{k}</span>
              <span className="flex items-center gap-1 truncate font-semibold text-foreground">
                {v} <Check className="h-3 w-3 shrink-0 text-success" />
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <span {...a("pop", 2.8)} className="inline-flex items-center gap-1 rounded-full bg-success-tint px-1.5 py-0.5 text-[9px] font-semibold text-success">
            <ShieldCheck className="h-3 w-3" /> Check digits valid
          </span>
          <span {...a("pop", 3.2)} className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-1.5 py-0.5 text-[9px] font-semibold text-primary-strong">
            3 CRM cards ready
          </span>
        </div>
      </Window>
    </div>
  );
}

/* ---------- 6. DeepThink ---------- */

function DeepThinkScene() {
  const thoughts = ["Two-year study gap: what explains it?", "Earlier refusal: what has changed since?", "Weigh Genuine Student evidence", "Compare UK and Canada options"];
  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span {...a("press", 0.3)} className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground shadow-cta">
          <Atom className="h-3 w-3" /> DeepThink
        </span>
        <span {...a("fade", 0.6)} className="text-[9.5px] text-muted-foreground">Slower, reasons harder</span>
      </div>
      <Window className="flex-1 p-3">
        <div {...a("fade", 0.8)} className="mb-2 flex items-center gap-1 text-[10px] font-semibold text-heading">
          <Clock className="h-3 w-3 text-primary" /> Thinking it through
        </div>
        <ol className="relative space-y-1.5 border-l border-dashed border-primary/40 pl-3">
          {thoughts.map((t, i) => (
            <li key={t} {...a("up", 1.1 + i * 0.55)} className="relative text-[10px] text-foreground">
              <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
              {t}
            </li>
          ))}
        </ol>
        <div {...a("up", 3.6)} className="mt-2.5 space-y-1">
          <Line w="92%" className="bg-foreground/20" />
          <Line w="74%" className="bg-foreground/15" />
        </div>
      </Window>
    </div>
  );
}

/* ---------- 7. Google Workspace ---------- */

function WorkspaceScene() {
  return (
    <div className="relative h-full">
      <div {...a("float", 0)} className="absolute left-0 top-1 w-[58%]">
        <Window className="p-2.5" {...a("up", 0.2)}>
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-heading">
            <Mail className="h-3.5 w-3.5 text-workspace" /> Gmail draft
          </div>
          <div className="text-[9px] text-muted-foreground">To: aayush.poudel@…</div>
          <div className="text-[9.5px] font-medium text-foreground">Your offer deposit: next steps</div>
          <div className="mt-1 space-y-1">
            <Line w="95%" />
            <Line w="70%" />
          </div>
          <div {...a("pop", 1.4)} className="mt-1.5 inline-flex rounded-full bg-workspace-tint px-1.5 py-0.5 text-[8.5px] font-semibold text-workspace-strong">Saved to Drafts · not sent</div>
        </Window>
      </div>
      <div {...a("float", 0.8)} className="absolute right-0 top-8 w-[46%]">
        <Window className="p-2.5" {...a("left", 0.9)}>
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-heading">
            <CalendarDays className="h-3.5 w-3.5 text-workspace" /> Calendar
          </div>
          <div className="text-[9.5px] font-medium text-foreground">Call with Aayush</div>
          <div className="text-[9px] text-muted-foreground">Tue · 10:00–10:30</div>
          <div {...a("pop", 2.0)} className="mt-1.5 inline-flex rounded-full bg-primary-tint px-1.5 py-0.5 text-[8.5px] font-semibold text-primary-strong">Approve to send invite</div>
        </Window>
      </div>
      <div {...a("float", 1.6)} className="absolute bottom-1 left-[18%] w-[52%]">
        <Window className="flex items-center gap-2 p-2.5" {...a("up", 1.8)}>
          <FileText className="h-4 w-4 text-workspace" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[9.5px] font-medium text-foreground">GS checklist: Aayush</div>
            <div className="text-[8.5px] text-muted-foreground">Google Doc, created from chat</div>
          </div>
        </Window>
      </div>
    </div>
  );
}

/* ---------- 8. Your day ---------- */

function DayScene() {
  const items = [
    { tone: "text-destructive", icon: AlertCircle, t: "Overdue: Sita's offer deposit follow-up" },
    { tone: "text-warning-foreground", icon: Clock, t: "Today 2:00 pm: call Aayush about the CoE" },
    { tone: "text-primary", icon: FileText, t: "Review Ram's financial documents" },
  ];
  return (
    <div className="flex h-full flex-col gap-2.5">
      <div {...a("left", 0)} className="ml-auto w-fit rounded-2xl rounded-br-md bg-primary px-3 py-1.5 text-[10.5px] font-medium text-primary-foreground">My day</div>
      <Window className="space-y-1.5 p-3">
        {items.map(({ tone, icon: Icon, t }, i) => (
          <div key={t} {...a("up", 0.5 + i * 0.4)} className="flex items-center gap-2 text-[10.5px] text-foreground">
            <Icon className={cn("h-3.5 w-3.5 shrink-0", tone)} />
            <span className="truncate">{t}</span>
          </div>
        ))}
      </Window>
      <div className="flex flex-wrap gap-1.5">
        {["Draft the deposit reminder", "Catch me up before the call", "Log a note for Ram"].map((t, i) => (
          <span key={t} {...a("pop", 2.0 + i * 0.25)} className="rounded-full border border-border bg-card px-2.5 py-1 text-[9.5px] font-medium text-foreground shadow-sm">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

const SCENES: Record<SceneId, () => ReactNode> = {
  welcome: WelcomeScene,
  answers: AnswersScene,
  journey: JourneyScene,
  crm: CrmScene,
  documents: DocumentsScene,
  deepthink: DeepThinkScene,
  workspace: WorkspaceScene,
  day: DayScene,
};
