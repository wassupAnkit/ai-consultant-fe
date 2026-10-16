import type { JourneyStepKey, StepStatus } from "./types";

/** Step keys in journey order; mirrors the backend's JOURNEY_STEP_KEYS (validated there too). */
export const JOURNEY_STEP_KEYS: readonly JourneyStepKey[] = ["enquiry", "destination", "course", "institution", "eligibility", "english", "application", "finances", "visa", "pre_departure"];
export const STEP_STATUSES: readonly StepStatus[] = ["not_started", "in_progress", "done"];

export function isJourneyStepKey(v: unknown): v is JourneyStepKey {
  return typeof v === "string" && (JOURNEY_STEP_KEYS as readonly string[]).includes(v);
}

/** Short labels for tight spots (sidebar, rail on phones); the full label comes from /api/journey. */
export const STEP_SHORT_LABEL: Record<JourneyStepKey, string> = {
  enquiry: "Enquiry",
  destination: "Destination",
  course: "Course",
  institution: "Institution",
  eligibility: "Eligibility",
  english: "English",
  application: "Application",
  finances: "Finances",
  visa: "Visa",
  pre_departure: "Pre-departure",
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase() || "?";
}
