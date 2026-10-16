"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, EyeOff, ExternalLink, GraduationCap, Handshake, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGuide } from "@/hooks/use-guide";
import { initials } from "@/lib/edge/journey";
import type { StudentField } from "@/lib/edge/types";
import { cn } from "@/lib/utils";

/** "just now", "3 min ago": how fresh the CRM read is. */
function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

/**
 * The guided session's student as the CRM has them right now. Read-only on purpose: the CRM
 * is where student facts live, so a gap here is fixed in the CRM ("Open in CRM"), and Edge
 * picks the change up on its next read.
 */
export function StudentPanel() {
  const g = useGuide();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!g.guide) {
    return (
      <div className="mt-10 px-5 text-center">
        <UserRound className="mx-auto h-6 w-6 text-muted-foreground/50" />
        <p className="mt-3 font-heading text-base text-heading">No student on this conversation</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Guided sessions show the student&rsquo;s CRM record here.</p>
      </div>
    );
  }

  const view = g.student;
  if (!view) {
    return g.studentError ? <ErrorCard message={g.studentError} onRetry={g.refreshStudent} /> : <PanelSkeleton />;
  }
  if (!view.crm.ok || !view.student) {
    return <ErrorCard message={view.crm.ok ? "The CRM returned no record." : view.crm.message} onRetry={g.refreshStudent} hidden={!view.crm.ok ? view.crm.reason === "not_visible" : false} />;
  }

  const crm = view.crm;
  const st = view.student;
  const stepGaps = view.steps.find((s) => s.key === g.guide!.currentStep);
  const step = g.current;
  const fieldsByKey = new Map(view.fields.map((f) => [f.key, f]));
  const stepFields = (step?.crmFields ?? []).map((f) => fieldsByKey.get(f.key) ?? { key: f.key, label: f.label, available: false, value: null });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      {/* Identity */}
      <div className="rounded-xl border border-teal/30 bg-teal-tint/60 p-3.5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-sm font-semibold text-teal-foreground ring-1 ring-teal/40">{initials(st.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-[17px] leading-tight text-heading">{st.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{[st.status, st.branch].filter(Boolean).join(" · ") || "No status recorded"}</p>
            {st.assignee && <p className="truncate text-xs text-muted-foreground">Assigned to {st.assignee}</p>}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {crm.webUrl && (
            <Button asChild variant="teal" size="sm">
              <a href={crm.webUrl} target="_blank" rel="noreferrer">
                Open in CRM <ExternalLink />
              </a>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={g.refreshStudent} disabled={g.studentLoading} aria-label="Read the CRM again">
            <RefreshCw className={cn(g.studentLoading && "animate-spin")} />
            <span className="text-[11px] font-normal text-muted-foreground">Read {ago(crm.fetchedAt, now)}</span>
          </Button>
        </div>
      </div>

      {/* This step */}
      {step && (
        <section className="mt-4" aria-labelledby="student-step">
          <h3 id="student-step" className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            For {step.label}
          </h3>
          {stepFields.length ? (
            <ul className="mt-2 space-y-1.5">{stepFields.map((f) => <FieldRow key={f.key} field={f} emphasise />)}</ul>
          ) : (
            <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">The CRM has no field for this step yet. Use the questions below and record the answers in a CRM note.</p>
          )}
          {stepGaps && stepGaps.askStudent.length > 0 && (
            <div className="mt-2.5 rounded-lg bg-muted/70 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground">Ask the student</p>
              <ul className="mt-1 space-y-0.5 text-[13px] text-foreground">
                {stepGaps.askStudent.map((a) => (
                  <li key={a}>• {a}</li>
                ))}
              </ul>
            </div>
          )}
          {stepGaps && stepGaps.missing.length > 0 && crm.webUrl && (
            <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
              Fill the missing fields in the CRM, then refresh. Edge reads the change on its next answer.
            </p>
          )}
        </section>
      )}

      {/* Deals and applications */}
      <section className="mt-5" aria-labelledby="student-pipeline">
        <h3 id="student-pipeline" className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Pipeline
        </h3>
        <ul className="mt-2 space-y-1.5">
          {st.deals.map((d) => (
            <li key={d.id} className="rounded-lg border border-border bg-card px-3 py-2">
              <div className="flex items-center gap-2">
                <Handshake className="h-3.5 w-3.5 shrink-0 text-teal-foreground dark:text-teal" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{d.name ?? "Deal"}</span>
                {d.status && <StatusPill text={d.status} />}
              </div>
              {(d.countries.length > 0 || d.service) && <p className="mt-1 pl-5 text-xs text-muted-foreground">{[d.service, d.countries.join(", ")].filter(Boolean).join(" · ")}</p>}
            </li>
          ))}
          {view.fields.find((f) => f.key === "institutions")?.available &&
            st.applications.map((a) => (
              <li key={a.id} className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{a.institution ?? "Application"}</span>
                  {a.status && <StatusPill text={a.status} />}
                </div>
                <p className="mt-1 pl-5 text-xs text-muted-foreground">{[a.course, a.intake && `Intake ${a.intake}`, a.workflowStage && `Stage: ${a.workflowStage}`].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          {st.deals.length === 0 && st.applications.length === 0 && <li className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">No deals or applications visible to you.</li>}
        </ul>
      </section>

      {/* Everything Edge can read */}
      <section className="mt-5" aria-labelledby="student-record">
        <h3 id="student-record" className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          CRM record
        </h3>
        <ul className="mt-2 divide-y divide-border/70 rounded-lg border border-border bg-card">
          {view.fields.map((f) => (
            <FieldRow key={f.key} field={f} compact />
          ))}
        </ul>
        <p className="mt-2.5 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
          Read live from the CRM as you, and never stored by Edge. &ldquo;Not visible&rdquo; means the CRM doesn&rsquo;t share that field with Edge yet, not that it&rsquo;s empty.
        </p>
      </section>
    </div>
  );
}

function FieldRow({ field, emphasise, compact }: { field: StudentField; emphasise?: boolean; compact?: boolean }) {
  const state = !field.available ? "unknown" : field.value ? "filled" : "missing";
  const Icon = state === "filled" ? CheckCircle2 : state === "missing" ? CircleDashed : EyeOff;
  return (
    <li
      className={cn(
        "flex items-start gap-2.5",
        compact ? "px-3 py-2" : "rounded-lg border px-3 py-2",
        !compact && state === "filled" && "border-border bg-card",
        !compact && state === "missing" && "border-warning/50 bg-warning-tint",
        !compact && state === "unknown" && "border-border bg-muted/60",
      )}
    >
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", state === "filled" && "text-success", state === "missing" && "text-warning-foreground", state === "unknown" && "text-muted-foreground/70")} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-[11.5px]", emphasise ? "font-medium text-foreground" : "text-muted-foreground")}>{field.label}</p>
        <p className={cn("text-[13px]", state === "filled" ? "text-heading" : "text-muted-foreground", state === "missing" && "text-warning-foreground")}>
          {state === "filled" ? field.value : state === "missing" ? "Missing in CRM" : "Not visible to Edge"}
        </p>
      </div>
    </li>
  );
}

function StatusPill({ text }: { text: string }) {
  return <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-px text-[10.5px] font-medium capitalize text-muted-foreground">{text}</span>;
}

function ErrorCard({ message, onRetry, hidden }: { message: string; onRetry: () => void; hidden?: boolean }) {
  return (
    <div className="p-3">
      <div className="rounded-xl border border-warning/50 bg-warning-tint p-4">
        <div className="flex items-start gap-2.5">
          {hidden ? <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />}
          <div className="min-w-0">
            <p className="text-sm font-medium text-warning-foreground">{hidden ? "You can't see this student in the CRM" : "The CRM record couldn't be read"}</p>
            <p className="mt-1 text-xs leading-relaxed text-warning-foreground/90">{message}</p>
            <p className="mt-1 text-xs leading-relaxed text-warning-foreground/90">Edge keeps guiding the steps, but answers won&rsquo;t use the student&rsquo;s CRM facts until it can read them.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-3 p-3" aria-busy="true" aria-label="Reading the CRM">
      <div className="h-28 animate-pulse rounded-xl bg-teal-tint/60" />
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="h-14 animate-pulse rounded-lg bg-muted" />
      <div className="h-14 animate-pulse rounded-lg bg-muted" />
      <div className="h-40 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
