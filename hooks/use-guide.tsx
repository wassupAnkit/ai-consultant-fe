"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { createGuidedSession, EdgeApiError, getJourney, getStudent, patchGuide } from "@/lib/edge/api";
import type { CrmContactMatch, GuidePatch, GuideState, JourneyStep, JourneyStepKey, StepStatus, StudentView } from "@/lib/edge/types";
import { track } from "@/lib/analytics";
import { useChat } from "./use-chat";
import { useSessions } from "./use-sessions";

/**
 * Guided journey sessions on the client. The journey itself (current step, step statuses,
 * Edge's suggestion) is the session's own record; the student is read live from the CRM on
 * open, on refresh and after every answer, and is never kept anywhere but in memory here.
 */
interface GuideContextValue {
  /** The ten steps, in order; empty until loaded. */
  steps: JourneyStep[];
  /** The shown session's journey; null for a normal chat. */
  guide: GuideState | null;
  /** The current step's definition. */
  current: JourneyStep | null;
  student: StudentView | null;
  studentLoading: boolean;
  studentError: string | null;
  refreshStudent: () => void;
  /** Change the journey; optimistic, rolled back with a toast on failure. */
  update: (patch: GuidePatch) => Promise<boolean>;
  moveTo: (step: JourneyStepKey) => Promise<boolean>;
  setStepStatus: (step: JourneyStepKey, status: StepStatus) => Promise<boolean>;
  /** Mark the current step done and move to the next one. */
  completeCurrent: () => Promise<boolean>;
  /**
   * A student @-mentioned in the message box of a chat that is not guided yet. Nothing is
   * created until the message is sent (`commitStudent`), so a mention can still be removed.
   */
  pendingStudent: CrmContactMatch | null;
  attachStudent: (student: CrmContactMatch) => void;
  detachStudent: () => void;
  /**
   * Called by the composer just before it sends: a new chat becomes a guided session about the
   * attached student, an existing one is converted (one way). False when that failed (the
   * message is then not sent). A no-op without an attached student.
   */
  commitStudent: () => Promise<boolean>;
  busy: boolean;
}

const GuideContext = createContext<GuideContextValue | null>(null);

function errorText(err: unknown, fallback: string): string {
  if (err instanceof EdgeApiError) {
    if (err.code === "crm_unavailable") return "The CRM isn't connected for your account right now, so guided sessions can't reach the student's record.";
    if (err.code === "contact_not_found") return "That student isn't visible to you in the CRM.";
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

/** Apply a patch locally for the optimistic update (the server's answer replaces it). */
function applyLocal(guide: GuideState, patch: GuidePatch): GuideState {
  const now = new Date().toISOString();
  let steps = guide.steps.map((s) => ({ ...s }));
  let suggestion = guide.suggestion;
  let currentStep = guide.currentStep;
  if (patch.currentStep && patch.currentStep !== currentStep) {
    currentStep = patch.currentStep;
    steps = steps.map((s) => (s.key === currentStep && s.status === "not_started" ? { ...s, status: "in_progress", updatedAt: now } : s));
    if (suggestion?.toStep === currentStep) suggestion = null;
  }
  for (const [k, v] of Object.entries(patch.stepStatus ?? {})) steps = steps.map((s) => (s.key === k ? { ...s, status: v as StepStatus, updatedAt: v === "not_started" ? null : now } : s));
  if (patch.dismissSuggestion) suggestion = null;
  return { ...guide, currentStep, steps, suggestion };
}

export function GuideProvider({ children }: { children: ReactNode }) {
  const sessions = useSessions();
  const { activeSessionId, activeSession, setActiveSession, adoptSession, status } = useChat();
  const [pendingStudent, setPendingStudent] = useState<CrmContactMatch | null>(null);
  const [steps, setSteps] = useState<JourneyStep[]>([]);
  const [student, setStudent] = useState<StudentView | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const guide = activeSession?.guide ?? null;
  const contactId = guide?.contactId ?? null;

  useEffect(() => {
    getJourney()
      .then(setSteps)
      .catch(() => {
        /* the rail waits for the next guided session to retry */
      });
  }, [guide !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- The student, live from the CRM --------------------------------------------
  const loadAbort = useRef<AbortController | null>(null);
  const loadStudent = useCallback((sessionId: string, quiet = false) => {
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    if (!quiet) setStudentLoading(true);
    getStudent(sessionId, controller.signal)
      .then((view) => {
        if (controller.signal.aborted) return;
        setStudent(view);
        setStudentError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setStudentError(errorText(err, "Could not read the student from the CRM"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setStudentLoading(false);
      });
  }, []);

  useEffect(() => {
    setStudent(null);
    setStudentError(null);
    if (activeSessionId && contactId) loadStudent(activeSessionId);
    else loadAbort.current?.abort();
  }, [activeSessionId, contactId, loadStudent]);

  // After each answer: the consultant may have updated the CRM while Edge was answering.
  const lastStatus = useRef(status);
  useEffect(() => {
    if (lastStatus.current === "streaming" && status === "idle" && activeSessionId && contactId) loadStudent(activeSessionId, true);
    lastStatus.current = status;
  }, [status, activeSessionId, contactId, loadStudent]);

  const refreshStudent = useCallback(() => {
    if (activeSessionId && contactId) loadStudent(activeSessionId);
  }, [activeSessionId, contactId, loadStudent]);

  // --- Journey changes ----------------------------------------------------------
  const update = useCallback(
    async (patch: GuidePatch) => {
      if (!activeSession || !activeSessionId) return false;
      const before = activeSession;
      if (before.guide && !patch.convert) setActiveSession({ ...before, guide: applyLocal(before.guide, patch) });
      try {
        const next = await patchGuide(activeSessionId, patch);
        setActiveSession(next);
        void sessions.refresh();
        return true;
      } catch (err) {
        setActiveSession(before);
        toast.error(errorText(err, "Could not update the journey"));
        return false;
      }
    },
    [activeSession, activeSessionId, setActiveSession, sessions],
  );

  const moveTo = useCallback(
    async (step: JourneyStepKey) => {
      if (!guide || step === guide.currentStep) return true;
      const ok = await update({ currentStep: step });
      if (ok) track("guide_step_move", { from: guide.currentStep, to: step });
      return ok;
    },
    [guide, update],
  );

  const setStepStatus = useCallback((step: JourneyStepKey, s: StepStatus) => update({ stepStatus: { [step]: s } }), [update]);

  const completeCurrent = useCallback(async () => {
    if (!guide || !steps.length) return false;
    const idx = steps.findIndex((s) => s.key === guide.currentStep);
    const next = steps[idx + 1];
    const ok = await update({ stepStatus: { [guide.currentStep]: "done" }, ...(next ? { currentStep: next.key } : {}) });
    if (ok) {
      track("guide_step_done", { step: guide.currentStep });
      toast.success(next ? `On to ${next.label}.` : "Journey complete.");
    }
    return ok;
  }, [guide, steps, update]);

  // A mention belongs to the chat it was typed in.
  useEffect(() => setPendingStudent(null), [activeSessionId]);
  const attachStudent = useCallback((student: CrmContactMatch) => setPendingStudent(student), []);
  const detachStudent = useCallback(() => setPendingStudent(null), []);

  const commitStudent = useCallback(async () => {
    const student = pendingStudent;
    if (!student || guide) return true;
    setBusy(true);
    try {
      if (activeSessionId) {
        setActiveSession(await patchGuide(activeSessionId, { convert: { contactId: student.id } }));
        track("guide_convert", { via: "mention" });
      } else {
        adoptSession(await createGuidedSession(student.id));
        track("guide_start", { via: "mention" });
      }
      setPendingStudent(null);
      void sessions.refresh();
      return true;
    } catch (err) {
      toast.error(errorText(err, "Could not attach the student"));
      return false;
    } finally {
      setBusy(false);
    }
  }, [pendingStudent, guide, activeSessionId, setActiveSession, adoptSession, sessions]);

  const current = useMemo(() => (guide ? (steps.find((s) => s.key === guide.currentStep) ?? null) : null), [guide, steps]);

  const value = useMemo<GuideContextValue>(
    () => ({ steps, guide, current, student, studentLoading, studentError, refreshStudent, update, moveTo, setStepStatus, completeCurrent, pendingStudent, attachStudent, detachStudent, commitStudent, busy }),
    [steps, guide, current, student, studentLoading, studentError, refreshStudent, update, moveTo, setStepStatus, completeCurrent, pendingStudent, attachStudent, detachStudent, commitStudent, busy],
  );
  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useGuide(): GuideContextValue {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error("useGuide must be used within GuideProvider");
  return ctx;
}
