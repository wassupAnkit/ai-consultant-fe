/**
 * Shapes exchanged with the Edge backend (expert-ai-consultant) through the
 * Next.js proxy routes under /api. Keep in sync with the backend's routes.ts.
 */
/** Edge has one persona; older backends reported "counsellor", the current one "consultant". */
export type ChatMode = "consultant" | "counsellor";

export interface EdgeIntent {
  primary: string;
  secondary: string[];
  /** What the consultant wants done: lookup, compare, draft, review, eligibility… */
  task?: string;
  needsResearch?: boolean;
  confidence: "low" | "medium" | "high";
  inScope: boolean;
  destinations: string[];
  flags: string[];
  language: string;
}

/**
 * The reasoning trace. The backend streams these as `status` and `tool` events on every
 * turn: `status` is the phase it is in, `tool` is one lookup starting or finishing.
 */
export type EdgeStage = "classifying" | "researching" | "answering";

export interface EdgeToolEvent {
  tool: string;
  status: "start" | "end";
  /** Consultant-facing label, e.g. "Checking your tasks and follow-ups". */
  label: string;
  query?: string;
  url?: string;
  ms?: number;
  ok?: boolean;
}

/** One row of the trace, folded from a tool's start and end events. */
export interface ReasoningStep {
  key: string;
  label: string;
  state: "running" | "done" | "failed";
  ms?: number;
}

/**
 * One stretch of the model's own reasoning, placed among the lookups: `at` is how many
 * lookups (ReasoningStep rows) came before it, so the panel can show think → search →
 * think → read → answer in the order it happened.
 */
export interface ThoughtSegment {
  at: number;
  text: string;
  /** Phase it was written in, while streaming; a new phase starts a new paragraph. Not stored. */
  stage?: EdgeStage | null;
}

/** An excerpt the answer cited as [n]: an indexed page, a live web page, a program record or a CRM record. */
export interface EdgeSource {
  n: number;
  url: string;
  title: string;
  section?: string | null;
  excerpt?: string;
  docType?: string | null;
  country?: string | null;
  score?: number;
  /** Absolute https page for the record in the CRM front end. Only CRM records carry it,
   *  and only when the record has a page — `url` stays the unbrowsable `crm://` URI. */
  webUrl?: string | null;
  /** Where it came from: experteducation.com, partner:<slug>, upload:<slug>, web:google, live:<host>… */
  source?: string | null;
  /** Provenance class of indexed chunks (site / partner / upload / program); absent for live evidence. */
  sourceKind?: string | null;
  /** Fetched from the live web during this turn rather than read from the index. */
  live?: boolean;
}

/** What the research phase did, from `done.research`. */
export interface ResearchSummary {
  rounds: number;
  toolCalls: number;
  liveUrls: string[];
  budgetExceeded: boolean;
  /** The research model's own "what I could / couldn't find". */
  notes: string | null;
  error: string | null;
}

/** Payload of the `done` stream event / the non-streaming chat response. */
export interface EdgeDone {
  sessionId: string;
  requestId: string;
  traceId: string | null;
  mode?: ChatMode;
  answer: string;
  refused: boolean;
  intent: EdgeIntent | null;
  sources: EdgeSource[];
  research?: ResearchSummary | null;
  disclaimer: string | null;
  latencyMs: number;
  /** Always empty at `done`; the real chips arrive in the `suggestions` event that follows. */
  followUps?: string[];
}

/** `session` event: the backend named a new conversation after its first answer. */
export interface EdgeSessionEvent {
  sessionId: string;
  title: string;
}

/** `suggestions` event: follow-up questions for the answer with this `requestId`. */
export interface EdgeSuggestionsEvent {
  requestId: string;
  items: string[];
}

/** `guide` event (guided sessions): Edge suggested moving on; the journey as it now stands. */
export interface EdgeGuideEvent {
  sessionId: string;
  guide: GuideState;
}

export interface EdgeError {
  code: string;
  message: string;
  requestId?: string;
}

export interface SessionSummary {
  id: string;
  title: string | null;
  messageCount: number;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  mode: ChatMode;
  /** Pinned conversations sort above the date groups in the sidebar. */
  pinned: boolean;
  /** A guided session about one CRM student (absent on older backends = false). */
  guided?: boolean;
  /** The journey step a guided session is on. */
  currentStep?: JourneyStepKey | null;
}

// ---------------------------------------------------------------------------
// CRM write approvals
// ---------------------------------------------------------------------------
/**
 * Mirror of Edge's `src/crm/approvals/types.ts` (backend repo expert-ai-consultant). This
 * repo has no shared package with Edge, so these shapes are kept in sync by hand with that
 * file — drift here silently breaks the `crm_write_proposal` stream event and the decision
 * route's response.
 */
export type CrmWriteValue = string | number | boolean | null;

export interface CrmWriteChange {
  field: string;
  label: string;
  before: CrmWriteValue;
  after: CrmWriteValue;
}

export type CrmWriteStatus = "pending" | "applying" | "applied" | "rejected" | "expired" | "stale" | "failed";

/** Where an approved proposal is written: the CRM (the default, and every row that predates the
 *  field), the consultant's own Gmail (a draft, never sent), their Google Calendar (an event,
 *  whose attendees Google emails an invite on Approve) or a new private Doc/Sheet in their Drive. */
export type CrmWriteProvider = "crm" | "gmail" | "calendar" | "docs";

export interface CrmWriteProposalView {
  proposalId: string;
  requestId: string;
  tool: string;
  /** Absent means "crm". */
  provider?: CrmWriteProvider;
  target: {
    entity: "contact" | "enquiry" | "officeVisit" | "note" | "document" | "gmailDraft" | "calendarEvent" | "googleDoc" | "googleSheet";
    id: string | null;
    label: string;
    parentLabel?: string;
  };
  changes: CrmWriteChange[];
  status: CrmWriteStatus;
  expiresAt: string;
  decidedAt?: string;
  error?: string;
  /** Present only when `status === "stale"`: the record's current values, for a second table. */
  current?: CrmWriteChange[];
  /** Set once `applied`, when the write produced something to point at (a Gmail draft, a Calendar event, a Doc or Sheet). */
  result?: { link?: string; id?: string };
  /** The counsellor changed these values on the card before approving (`crm_update_contact` only). */
  edited?: CrmWriteEdit[];
}

/** One value the counsellor edited on an approval card: the proposed value and what was written instead. */
export interface CrmWriteEdit {
  field: string;
  from: CrmWriteValue;
  to: CrmWriteValue;
}

/** `edits` on `POST /v1/crm/writes/:id/decision`: `changes[].field` -> the value to write instead. */
export type CrmWriteEdits = Record<string, CrmWriteValue>;

// ---------------------------------------------------------------------------
// Document intake (student passports and national IDs attached in chat)
// ---------------------------------------------------------------------------
/** `POST /v1/chat/attachments` -> `{ attachment }`; also replayed on human turns in history. */
export interface AttachmentView {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Hex sha256 of the file as stored. */
  sha256: string;
  createdAt: string;
}

export type DocumentType = "passport" | "national_id" | "other";

export interface DocumentField {
  key: string;
  label: string;
  value: string;
  confidence: "high" | "medium" | "low";
  /** Read from the machine-readable zone (checksummed) or from the printed page. */
  source: "mrz" | "visual";
}

export interface DocumentWarning {
  /** mrz_checksum_failed, expired, expires_within_12_months, name_mismatch_crm, dob_mismatch_crm,
   *  unreadable, not_identity_document, no_student_selected, aadhaar_masked */
  code: string;
  message: string;
}

/** `document_extraction` stream event: what Edge read from one attached file. */
export interface DocumentExtractionView {
  attachmentId: string;
  fileName: string;
  documentType: DocumentType;
  /** The CRM checklist name the file is filed under ("Passport", "Citizenship/National ID"), or null for other. */
  crmDocumentType: string | null;
  /** Issuing country, English name. */
  country: string | null;
  holderName: string | null;
  fields: DocumentField[];
  warnings: DocumentWarning[];
}

// ---------------------------------------------------------------------------
// Connected Google accounts (Gmail, Drive, Calendar, Docs & Sheets)
// ---------------------------------------------------------------------------

/** "docs" is Docs & Sheets: creating new files only (reading existing ones goes through Drive). */
export type IntegrationService = "gmail" | "drive" | "calendar" | "docs";
export type IntegrationStatus = "connected" | "not_connected" | "reauth_required" | "error";

export interface IntegrationView {
  service: IntegrationService;
  status: IntegrationStatus;
  googleEmail: string | null;
  connectedAt: string | null;
}

/** `GET /v1/integrations`. `enabled: false` = this deployment has no Google connection at all. */
export interface IntegrationsResponse {
  enabled: boolean;
  integrations: IntegrationView[];
}

export interface HistoryMessage {
  role: "human" | "ai";
  content: string;
  intent: string | null;
  createdAt: string;
  sources: EdgeSource[];
  refused: boolean;
  disclaimer: string | null;
  requestId: string | null;
  traceId: string | null;
  /** Lookups the answer was built from, replayed so a reopened thread keeps its trace.
   *  Absent on `human` turns and on anything answered before the backend stored it. */
  reasoning?: ReasoningStep[];
  /** The model's reasoning, in timeline order with `reasoning`. Absent before it was stored. */
  thoughts?: ThoughtSegment[];
  /** True when the turn was asked with DeepThink on. */
  deepThink?: boolean;
  latencyMs?: number;
  /** Follow-up questions the backend suggested for this answer. */
  followUps?: string[];
  /** The consultant stopped this answer; the text is what they saw, not a finished reply. */
  stopped?: boolean;
  /** The full classified intent as stored with the answer; null on turns that predate it. */
  intentDetail?: EdgeIntent | null;
  /** CRM write proposals raised while answering this turn, matched by `requestId`. */
  crmWrites?: CrmWriteProposalView[];
  /** Guided sessions: the journey step this answer was given at. */
  guideStep?: JourneyStepKey | null;
  /** Human turns: the files attached to the question. */
  attachments?: AttachmentView[];
  /** AI turns: what Edge read from those files (same objects as streamed). */
  documents?: DocumentExtractionView[];
}

export interface SessionHistory {
  session: Omit<SessionSummary, "mode"> & { ownerId?: string; metadata?: Record<string, unknown>; guide?: GuideState | null };
  messages: HistoryMessage[];
  count: number;
}

export interface KnowledgeResult {
  id: string;
  url: string;
  title: string;
  section: string | null;
  docType: string | null;
  country: string | null;
  source: string;
  sourceKind?: string | null;
  score: number;
  matchedBy: ("vector" | "text")[];
  excerpt: string;
}

export interface KnowledgeSearchRequest {
  query: string;
  k?: number;
  countries?: string[];
  docTypes?: string[];
}

export interface KnowledgeSearchResponse {
  query: string;
  results: KnowledgeResult[];
  count: number;
}

// ---------------------------------------------------------------------------
// Guided journey sessions
// ---------------------------------------------------------------------------
// A guided session walks one CRM student through ten journey steps. Edge stores only the
// contact id and the journey progress; everything about the student is read live from the
// CRM (GET /api/sessions/:id/student), so nothing here is a copy of CRM data.

export type JourneyStepKey = "enquiry" | "destination" | "course" | "institution" | "eligibility" | "english" | "application" | "finances" | "visa" | "pre_departure";
export type StepStatus = "not_started" | "in_progress" | "done";

export interface JourneyStep {
  key: JourneyStepKey;
  order: number;
  label: string;
  docStages: string[];
  goal: string;
  checklist: string[];
  crmFields: { key: string; label: string }[];
  askStudent: string[];
  relatedIntents: string[];
  caseStages: string[];
}

export interface GuideStepState {
  key: JourneyStepKey;
  status: StepStatus;
  updatedAt: string | null;
}

export interface GuideSuggestion {
  toStep: JourneyStepKey;
  reason: string;
  at: string;
}

export interface GuideState {
  contactId: string;
  currentStep: JourneyStepKey;
  steps: GuideStepState[];
  suggestion: GuideSuggestion | null;
  startedAt: string;
}

export interface GuidePatch {
  currentStep?: JourneyStepKey;
  stepStatus?: Partial<Record<JourneyStepKey, StepStatus>>;
  dismissSuggestion?: boolean;
  convert?: { contactId: string; step?: JourneyStepKey };
}

export interface CrmContactMatch {
  id: string;
  name: string;
  email: string | null;
  status: string | null;
  branch: string | null;
}

export interface StudentField {
  key: string;
  label: string;
  /** False when this CRM does not expose that part of the record to Edge. */
  available: boolean;
  value: string | null;
}

export interface StudentDeal {
  id: string;
  name: string | null;
  status: string | null;
  service: string | null;
  countries: string[];
  services: string[];
}

export interface StudentApplication {
  id: string;
  status: string | null;
  institution: string | null;
  course: string | null;
  intake: string | null;
  workflowStage: string | null;
}

export interface StudentStepGaps {
  key: JourneyStepKey;
  /** CRM fields this step needs that are empty in the CRM. */
  missing: string[];
  /** CRM fields this step needs that the CRM does not show Edge (unknown, not missing). */
  unknown: string[];
  askStudent: string[];
}

export interface StudentView {
  contactId: string;
  crm: { ok: true; via: string; fetchedAt: string; webUrl: string | null } | { ok: false; reason: "no_crm" | "not_visible" | "error"; message: string };
  student: { name: string; status: string | null; branch: string | null; assignee: string | null; deals: StudentDeal[]; applications: StudentApplication[] } | null;
  fields: StudentField[];
  steps: StudentStepGaps[];
}

// ---------------------------------------------------------------------------
// UI model
// ---------------------------------------------------------------------------
export type MessageStatus = "streaming" | "done" | "stopped" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  createdAt: string;
  intent?: EdgeIntent | null;
  sources?: EdgeSource[];
  research?: ResearchSummary | null;
  disclaimer?: string | null;
  refused?: boolean;
  requestId?: string | null;
  traceId?: string | null;
  latencyMs?: number;
  /** Human-readable failure reason when `status === "error"`. */
  error?: string;
  /** Lookups this answer was built from, in order. Kept on the message so the trace
   *  stays with the answer rather than only existing while the turn runs. */
  reasoning?: ReasoningStep[];
  /** The model's own reasoning for this turn, in timeline order with `reasoning`: built
   *  from the stream's `thinking` chunks while it runs, replayed from history after. Turns
   *  answered before the backend stored it have none, which renders as no thought text. */
  thoughts?: ThoughtSegment[];
  /** Asked with DeepThink on (the model reasoned harder). */
  deepThink?: boolean;
  /** Phase the turn is in; null once it has finished. */
  stage?: EdgeStage | null;
  /** Suggested next questions; shown as chips under the newest answer only. */
  followUps?: string[];
  /** CRM write proposals raised while answering this turn; rendered as approval cards. */
  crmWrites?: CrmWriteProposalView[];
  /** Guided sessions: the journey step the turn was asked at. */
  guideStep?: JourneyStepKey | null;
  /** User turns: files sent with the question. */
  attachments?: AttachmentView[];
  /** Assistant turns: one card per attached file Edge read, keyed by `attachmentId`. */
  documents?: DocumentExtractionView[];
}
