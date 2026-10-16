/**
 * What the in-app guide teaches, as plain data: the welcome guide's slides (one per capability,
 * each with an animated scene) and the spotlight tours over the real controls. Kept free of React
 * so it can be tested and reviewed as copy.
 *
 * Every claim here must be true of the shipped product. When a feature changes, change its slide
 * and bump TOUR_VERSION so counsellors see the "What's new" tour once.
 */

/** Bump when a tour's steps change, so everyone sees the new version once. */
export const TOUR_VERSION = 2;

/** The feature set the "What's new" tour introduces; shown once to anyone who saw an older version. */
export const WHATS_NEW_SINCE = 1;

export type SceneId = "welcome" | "answers" | "journey" | "crm" | "documents" | "deepthink" | "workspace" | "day";

export interface GuideSlide {
  id: SceneId;
  /** Short label for the progress rail. */
  label: string;
  title: string;
  body: string;
  /** Three short, concrete lines: what the counsellor gets. */
  points: string[];
  /** Shown only when the deployment has this switch on. */
  requires?: "documentUpload";
}

export const GUIDE_SLIDES: GuideSlide[] = [
  {
    id: "welcome",
    label: "Welcome",
    title: "Meet Edge, your study-abroad co-pilot",
    body: "Edge answers counsellors' questions about students, courses, visas and costs, works inside your CRM caseload, and drafts the messages that follow, with every answer showing where it came from.",
    points: ["Answers in seconds, with sources", "Knows your students and your day", "Never changes the CRM without your approval"],
  },
  {
    id: "answers",
    label: "Cited answers",
    title: "Answers you can check, not just trust",
    body: "Every answer cites what it drew on: Expert Education's own pages, partner universities, course data and official government pages that Edge re-reads every night. Click a number to see the source.",
    points: [
      "Official visa and immigration pages, refreshed nightly",
      "Advice fitted to the student's home market and destination",
      "Fees and totals are checked; anything unsupported is flagged",
    ],
  },
  {
    id: "journey",
    label: "Student journey",
    title: "Type @ to work with a student",
    body: "Mention a student from your CRM and the chat follows their journey, from first enquiry to visa and departure. Edge knows where they are and suggests the next step.",
    points: ["Their CRM profile and history beside the chat", "A journey pill shows the current step", "Pick up any student's conversation later"],
  },
  {
    id: "crm",
    label: "CRM actions",
    title: "Update the CRM, on your say-so",
    body: "Ask Edge to log a note, update an enquiry or fix a contact's details. It shows exactly what will change, before and after, and nothing is written until you press Approve.",
    points: ["Before → after for every field", "Edit a value before approving", "Every change is audited in the CRM"],
  },
  {
    id: "documents",
    label: "Documents",
    title: "Drop in a passport or ID",
    body: "Attach a student's passport or citizenship / national ID. Edge reads it, checks it, and proposes the CRM updates (profile, a note with the rest, and the file itself) as cards you approve.",
    points: [
      "Passport check digits verified; expiry and name mismatches flagged",
      "Nepali B.S. dates kept as written; Aadhaar masked to the last 4 digits",
      "Files are encrypted at rest and kept with the student's history",
    ],
    requires: "documentUpload",
  },
  {
    id: "deepthink",
    label: "DeepThink",
    title: "DeepThink for the hard questions",
    body: "Turn on DeepThink when a case is tricky, such as gaps in study, refusals or multi-country comparisons. Edge takes longer, reasons step by step and shows its working above the answer.",
    points: ["Shows how it reached the answer", "Best for complex, multi-part cases", "Stays on for your next questions until you switch it off"],
  },
  {
    id: "workspace",
    label: "Gmail & Calendar",
    title: "Connect Gmail, Calendar and Drive",
    body: "Connect your Google account from the account menu and Edge can draft emails to students, set up calls and find documents, each one waiting on a card for you to approve.",
    points: ["Drafts land in your Gmail, never sent automatically", "Calendar invites for student calls", "Find and create Docs from chat"],
  },
  {
    id: "day",
    label: "Your day",
    title: "Start every day with Edge",
    body: "Ask \"My day\" for what is due and overdue, or \"Catch me up before a call\" for where a student's deal stands. The starter prompts on the home screen are a good first try.",
    points: ["Overdue tasks first", "A briefing before every call", "Follow-up questions suggested after each answer"],
  },
];

/** A spotlight step over a real control, found by its `data-tour` attribute. */
export interface TourStep {
  target: string;
  title: string;
  body: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  requires?: "documentUpload";
}

export type TourId = "basics" | "whats-new";

export const TOURS: Record<TourId, { title: string; steps: TourStep[] }> = {
  basics: {
    title: "Edge in one minute",
    steps: [
      {
        target: "composer",
        title: "Ask anything",
        body: "A student, a course, a visa rule, a cost, or \"draft a message to…\". Press Enter to send and Shift+Enter for a new line. Ctrl/⌘ K jumps here from anywhere.",
        side: "top",
      },
      {
        target: "mention",
        title: "@ a student",
        body: "Type @ and a name to bring a student from your CRM into the chat. Edge then follows their journey and can update their record, with your approval.",
        side: "top",
        align: "start",
      },
      {
        target: "attach",
        title: "Attach a passport or ID",
        body: "Click, drag or paste a scan. Edge reads it and proposes the CRM updates as cards. Up to 5 files of 10 MB each.",
        side: "top",
        requires: "documentUpload",
      },
      {
        target: "deepthink",
        title: "DeepThink",
        body: "For tricky cases. Slower, reasons harder and shows its working above the answer.",
        side: "top",
        align: "start",
      },
      {
        target: "starters",
        title: "Not sure where to start?",
        body: "These prompts show what Edge can do with your caseload, research and drafting. Click one to send it.",
        side: "top",
        align: "start",
      },
      {
        target: "sources",
        title: "Sources and search",
        body: "Each answer's sources open here. Use Search to look through the knowledge base yourself: partner universities, courses and official pages.",
        side: "left",
      },
      {
        target: "conversations",
        title: "Every conversation is kept",
        body: "Find, pin or rename past chats. Ctrl/⌘ Shift O starts a new one.",
        side: "right",
      },
      {
        target: "account",
        title: "Connect Google",
        body: "Connect Gmail, Drive and Calendar here so Edge can draft emails and invites for you. You can also switch to dark mode.",
        side: "bottom",
        align: "end",
      },
      {
        target: "help",
        title: "Help is always here",
        body: "Open the animated guide, replay this tour or see what's new from this ? button, any time.",
        side: "bottom",
        align: "end",
      },
    ],
  },
  "whats-new": {
    title: "What's new in Edge",
    steps: [
      {
        target: "attach",
        title: "New: read passports and IDs",
        body: "Attach a passport or citizenship / national ID with a student selected. Edge reads it, flags expiry and mismatches, and proposes the CRM updates and the file attach for you to approve.",
        side: "top",
        requires: "documentUpload",
      },
      {
        target: "composer",
        title: "New: official pages, checked nightly",
        body: "Edge now re-reads key government visa and immigration pages every night and cites them. Totals and fees in answers are checked, and any figure without a source is flagged.",
        side: "top",
      },
      {
        target: "help",
        title: "Replay any time",
        body: "The full feature guide, the tour and what's new live under this ? button.",
        side: "bottom",
        align: "end",
      },
    ],
  },
};

export interface TourFeatures {
  documentUpload: boolean;
}

/** Slides and steps this deployment can show (a switched-off feature is never advertised). */
export function slidesFor(features: TourFeatures): GuideSlide[] {
  return GUIDE_SLIDES.filter((s) => !s.requires || features[s.requires]);
}

export function stepsFor(id: TourId, features: TourFeatures): TourStep[] {
  return TOURS[id].steps.filter((s) => !s.requires || features[s.requires]);
}
