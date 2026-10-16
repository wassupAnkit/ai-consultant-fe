/** Product copy and static option lists for the counsellor workspace. */
export const BRAND = {
  name: "Edge",
  company: "Expert Education",
  tagline: "Knowledge assistant for counsellors",
  description:
    "Ask Edge anything about destinations, partner universities, entry requirements, costs, scholarships, visas and post-study work. Every answer is grounded in Expert Education's indexed knowledge base and cites its sources.",
  website: "https://experteducation.com",
} as const;

/** Groups the starter prompts sit under on the empty state, in display order. */
export const STARTER_GROUPS = ["Your caseload", "Research", "Drafting"] as const;
export type StarterGroup = (typeof STARTER_GROUPS)[number];

/**
 * Suggested first questions on the empty state; written for staff, not students. Picking one
 * fills the composer rather than sending, so a counsellor can swap in their own student,
 * university or country before asking.
 */
export const STARTER_PROMPTS: { group: StarterGroup; title: string; prompt: string }[] = [
  // Edge reads this agency's own CRM as the signed-in consultant, not just the knowledge
  // base, and nothing else on this screen says so. The first three are deliberately about
  // the reader's own day; without them a counsellor has no reason to guess they can ask.
  { group: "Your caseload", title: "My day", prompt: "What do I need to do today? Show anything overdue first." },
  { group: "Your caseload", title: "My students", prompt: "Who are my students, and which of them have something overdue?" },
  {
    group: "Your caseload",
    title: "Catch me up before a call",
    prompt: "Catch me up on my most recent student before I call them — where their deal stands, any open enquiry, and what was last discussed.",
  },
  {
    group: "Research",
    title: "Compare post-study work rights",
    prompt: "Compare post-study work rights for a Master's graduate in Australia, Canada and the United Kingdom, including duration and key conditions.",
  },
  {
    group: "Research",
    title: "English requirements for a partner",
    prompt: "What IELTS or PTE scores does Edith Cowan University require for postgraduate coursework, and are there any pathway options if a student falls short?",
  },
  {
    group: "Research",
    title: "Partner universities by field",
    prompt: "Which of our partner universities offer Nursing programs in Melbourne, and what are their indicative annual tuition fees?",
  },
  {
    group: "Research",
    title: "Scholarships for a market",
    prompt: "Which scholarships does Expert Education list for Nepali students heading to Australia or the UK, and what are the eligibility criteria?",
  },
  {
    group: "Drafting",
    title: "Genuine Student evidence checklist",
    prompt: "Draft a checklist of the evidence we advise students to prepare for the Australian Genuine Student requirement, in the order a student should gather it.",
  },
  {
    group: "Drafting",
    title: "Deposit-deadline follow-up",
    prompt: "Draft a short, friendly WhatsApp message to a student who missed their offer deposit deadline, asking whether they still intend to accept and what they need from us.",
  },
  {
    group: "Drafting",
    title: "CRM note from this thread",
    prompt: "Summarise this conversation as a CRM note: decisions, figures, dates and the next action.",
  },
];

/** Destination slugs understood by the backend's retrieval filter, with labels. */
export const DESTINATIONS: { slug: string; label: string; short: string }[] = [
  { slug: "australia", label: "Australia", short: "AU" },
  { slug: "canada", label: "Canada", short: "CA" },
  { slug: "united_kingdom", label: "United Kingdom", short: "UK" },
  { slug: "united_states", label: "United States", short: "US" },
  { slug: "new_zealand", label: "New Zealand", short: "NZ" },
  { slug: "germany", label: "Germany", short: "DE" },
  { slug: "ireland", label: "Ireland", short: "IE" },
  { slug: "netherlands", label: "Netherlands", short: "NL" },
  { slug: "malaysia", label: "Malaysia", short: "MY" },
  { slug: "uae", label: "United Arab Emirates", short: "UAE" },
  { slug: "thailand", label: "Thailand", short: "TH" },
];

export function destinationLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  if (slug === "global") return "Global";
  return DESTINATIONS.find((d) => d.slug === slug)?.label ?? slug.replace(/_/g, " ");
}

/** Human labels for the backend's intent taxonomy (fallback: prettified slug). */
export function intentLabel(intent: string | null | undefined): string | null {
  if (!intent) return null;
  return intent.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Backend session retention (SESSION_TTL_HOURS default); shown as a hint in the sidebar. */
export const SESSION_RETENTION_HINT = "Conversations are kept for 72 hours after their last message; guided sessions until you delete them.";

export const MAX_MESSAGE_CHARS = 8_000;
