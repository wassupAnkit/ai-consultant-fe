# Edge UI/UX plan: from chat window to consultant workspace

**Audience:** PO and devs · **Date:** 2026-09-28
**Repos read:** frontend `expert-chatbot-frontend-edge` @ `origin/main` (5f87f11), backend `expert-ai-consultant-thinking` @ `origin/master` (ca631cd). All paths below are relative to those repos. `FE` = frontend, `BE` = backend.
**Done on 2026-09-28, so not planned again here:**
- **DeepThink.** A composer toggle for higher reasoning effort. The reasoning streams deepseek.com-style (thought, then "Searched the web · Read 2 pages", then thought) and is stored and replayed from history. Branches: FE `feat/deepthink-expert-brand`, BE `feat/deepseek-thinking`.
- **Brand.** The Expert Education logo, one per view: the lockup in the header and on login, and the book mark as the answer avatar. Favicon, PWA and Apple icons are now the Expert mark instead of the stock graduation cap.
- **Composer.** Rebuilt as one card with a borderless auto-growing input, toolbar row, solid send button and quieter hints.
- **KB search filter bug.** A picked destination returned only generic "global" pages. It now filters strictly; BE branch `fix/kb-search-country-filter`.
- **History latency.** History `latencyMs` is now mapped, so "Thought for Ns" survives a reload.

---

## 1. Current state

### What already works
- **Three-pane shell.** Conversations, thread and sources (`components/chat/chat-workspace.tsx:69-113`). The sources column docks only at `xl` (1280px or wider); below that it opens as a drawer (`hooks/use-media-query.tsx:32`).
- **Streaming.** Stage labels, tool rows and live thinking in a collapsible trace (`reasoning-trace.tsx:19-144`, `lib/edge/reasoning.ts`). Tool rows are saved and replayed in history (`use-chat.tsx:54`).
- **Inline `[n]` citation chips.** CRM records show green; ⌘/Ctrl-click opens the CRM deep link (`citation-chip.tsx:18-62`). The sources panel has a Cited tab and a KB Search tab with country filters (`components/sources/*`).
- **Sessions.** Title search, pin, rename and delete (`session-sidebar.tsx`). Shortcuts: ⌘K, ⌘⇧O and Esc (`hooks/use-chat-shortcuts.tsx:93-121`).
- **Resilience.** Offline and rate-limit wording (`lib/edge/stream.ts:56-112`). Per-answer thumbs with an optional comment (`feedback-buttons.tsx`).
- **Performance.** Markdown is lazy-loaded, which took first-load JS from 516 kB to 184 kB (`components/chat/markdown.tsx`).
- **Analytics already in place.** The events are `chat_send`, `chat_done` (with `firstTokenMs`), `source_click`, `sources_panel_open`, `copy_answer`, `regenerate`, `feedback_click`, `knowledge_search` and `session_*` (`lib/analytics.ts`, `lib/edge/stream.ts:241`).

### Data the backend already sends that the UI drops
| Data | Backend | Frontend gap |
|---|---|---|
| `intent.task`, `intent.needsResearch` | `src/app/service.ts:92-103` | Not in the `EdgeIntent` type (`lib/edge/types.ts:7-15`). The task (draft/compare/eligibility…) is never shown. |
| `intent.flags`: risk cues such as `prior_visa_refusal`, `study_gap`, `urgent_timeline`, `integrity_risk` | `src/schemas/intent.schema.ts:85-111` | Typed, but never rendered. `intent-badge.tsx` shows only the label and destinations. |
| `done.research` = `{rounds, toolCalls, liveUrls, budgetExceeded, notes, error}` | `routes.ts:221`, `service.ts:50-59` | Not typed or used. `notes` is the research model's own "what I could / couldn't find". |
| Source provenance: `live`, `kind` (kb/programs/web/page/crm), `source`, `sourceKind` | `src/retrieval/format.ts:5-28` | `EdgeSource` only tells CRM apart from everything else (`types.ts:43-55`). Live web pages look the same as indexed KB. |
| History `latencyMs` | `routes.ts:282` | Missing from `HistoryMessage` and not mapped in `fromHistory` (`use-chat.tsx:39-57`). Reopened threads lose "Thought for Xs" and the latency. |
| Tool `query` / `url` | `service.ts:26-35` | Discarded by `applyToolEvent` (`lib/edge/reasoning.ts:20`). The trace says "Searching knowledge base" but never says what it searched for. |
| Structured program records: tuition, intakes, deadlines, IELTS/PTE, scholarships, evidence quotes | `POST /v1/knowledge/programs/search` (`src/app.ts:202`, `src/ingest/programs.ts:36-61`) | No `/api` proxy. The UI can't show a program table. |
| KB freshness (`lastCrawledBySourceKind`) | `GET /v1/knowledge/status` (`app.ts:201`) | No proxy. Nothing in the UI shows how fresh the KB is. |
| Consultant profile/preferences | `GET/PATCH /v1/profile` (`app.ts:192`); injected as "Staff context" (`src/graph/nodes.ts:60`) | No proxy and no UI. The backend reads the profile, but nobody can set it. |
| Document upload into the KB | `POST/GET /v1/knowledge/documents` (`app.ts:203`) | No proxy and no UI. |
| Classifier extras: `audience`, `channel` (whatsapp/email/call_script/crm_note), `stage` (enquiry→arrived), `signals` | `intent.schema.ts:169-204`, used in prompts (`nodes.ts:143`) | **Not sent to the client.** `summarize()` leaves them out (`service.ts:517-529`). Surfacing them needs a small BE change. |

### UX gaps and friction found (grouped by area)

**Trust bugs**

1. **History fakes the confidence.** `fromHistory` hard-codes `confidence: "high"` (`use-chat.tsx:55`), so every reopened answer shows a green dot. The cause is that `getSession` returns only the primary intent string (`routes.ts:280`), even though the full summary is saved in `metadata.intent` (`service.ts:217`).
2. **Citation help text is wrong.** The empty-state footnote says "green ones are CRM records, the rest are the indexed knowledge base" (`empty-state.tsx:34`), and the sources panel says "knowledge-base excerpts" (`sources-panel.tsx:62`, `:97`). In fact, web hits and live-fetched pages are cited too.
3. **Cited tab lists more than was cited.** It shows every source attached to the answer, not just the ones the text cites. `citedNumbers()` exists but nothing uses it (`lib/edge/citations.ts:28`).
4. **No "not in the KB" state.** The answer prompt tells the model to write "not in the knowledge base" (`src/prompts/intents.ts:28`), but the UI never raises this, `research.notes`, or `budgetExceeded` as a visible warning.
5. **Noise in source cards.** Each card shows a raw `score 0.0123` (`source-card.tsx:77`), which means nothing to a consultant.

**Getting answers out of Edge**

6. **Copy gives raw markdown.** Copy puts markdown on the clipboard, including `[3]` markers, `**` and tables (`assistant-message.tsx:79-88`). Pasting into WhatsApp or email needs manual cleanup.
7. **No way to act on an answer.** There's no "draft as email/WhatsApp", no CRM note, and no export or print.
8. **Composer has no power features.** The layout was rebuilt on 2026-09-28, but there are still no templates, slash commands, attachments or student context.
9. **Unsent drafts are lost.** The draft is local state in `Composer`, so switching conversations loses unsent text.
10. **Only the last answer can be regenerated** (`assistant-message.tsx:34-37`). A user message can't be edited and resent.

**Getting started**

11. **Starters fire immediately.** Clicking a starter sends it at once (`chat-thread.tsx:26`), with no chance to adapt it. The nine starters are static (`lib/constants.ts:12-52`), and some are hard-coded to one partner or nationality (e.g. "Edith Cowan", "Nepali students").
12. **Empty state can't resume work.** It has no recent or pinned conversations and no sign of what Edge can currently see (CRM access, KB freshness).

**Student context**

13. **No student context at all.** A consultant can't pin a CRM student to a conversation. Every turn has to name the student again.

**Navigation**

14. **Sessions expire after 72h** (`SESSION_TTL_HOURS`, `src/config/env.ts:124`; hint at `lib/constants.ts:82`). That doesn't fit casework that runs for weeks. The list is also capped at 50 (`use-sessions.tsx:37`), search matches titles only (`session-sidebar.tsx:36`), and the day groups are just Today / Yesterday / Earlier (`lib/format.ts:16`).
15. **Row actions are hidden on touch.** Pin, rename and delete use `opacity-0 … group-hover:opacity-100` (`session-sidebar.tsx:215`), so they're invisible on phones and tablets. The `pr-24` that reserves their space also truncates every title (`:285`).
16. **Misleading delete copy.** It says "removed for everyone" (`session-sidebar.tsx:198`), but sessions belong to their owner.

**Feedback**

17. **Feedback is thin.** It's free text only, with no reason chips, and the thumbs state is forgotten when the thread is reopened (it lives only in local state, `feedback-buttons.tsx:24`).

**Brand, theme and dark mode**

18. **Brand is off-token.** `--primary` and `--ring` are shadcn's neutral black (`app/globals.css:13,25`), so default `Button`s render black while brand buttons use one-off `bg-brand-500` classes (`session-sidebar.tsx:97`, `composer.tsx:93`).
19. **Dead and conflicting styles.**
    - `gradient-brand` points to an undefined `var(--brand-500)` (`tailwind.config.ts:425`).
    - The purple `gradient-education` and pink `academic` palettes are unused leftovers.
    - The `themeColor` values white and `#0a0a0a` (`app/layout.tsx:28-29`) disagree with the manifest's `#006DD6`.
20. **Unbranded auth error page.** It shows developer copy, "Code error: …" (`app/auth/error/page.tsx:30`).

**Accessibility**

21. **Screen readers get every token.** `aria-live="polite"` sits on the whole streaming `<article>` (`assistant-message.tsx:91`), so every token fragment is announced.
22. **Small targets and text.**
    - Citation chips are about 18px (`citation-chip.tsx:37`) and feedback buttons are 28px, both near or under the WCAG 2.2 24px minimum once gaps are counted.
    - A lot of metadata is set at 10.5–11px.
23. **Colour-only signals.** The confidence dot (`intent-badge.tsx:5-9`) and green-for-CRM chips rely on colour. The intent details live only in a hover `title` (`:19`), so keyboard users can't reach them.
24. **Tabs aren't real tabs.** The sources tabs have `role="tab"` but no `aria-controls`, tabpanel or arrow-key navigation (`sources-panel.tsx:36-51`).
25. **Theme switcher.** It has no `aria-label` (`theme-switcher.tsx:33`), and it renders `null` before mount (`:24`), which shifts the header.
26. **Motion.** Nothing honours `prefers-reduced-motion` (bounce dots, spinners, smooth scroll).

**Performance**

27. **Every token re-renders the whole thread.** Each token patch maps the full message list (`use-chat.tsx:120-122`), and every `AssistantMessage` re-scans all messages for `isLastAnswer` (`assistant-message.tsx:34`). Cost grows with thread length on every token.

**Testing**

28. **No frontend tests** at all (no `*.test.*` files, no e2e).

---

## 2. Principles for an advanced consultant tool

1. **Speed to a usable output.** The goal is not a chat reply; it's a checked fact, a message to send, or a note to file. Every answer should be one click from reuse.
2. **Evidence first.** Every claim should trace to a source whose type and freshness are visible. Gaps should be said out loud ("not in the KB", "couldn't verify from the live page"). Confidence should be shown truthfully, never faked.
3. **The student is the unit of work.** Conversations, context and actions should hang off a CRM student, not off an anonymous thread.
4. **Actionable.** Drafts should be ready for the channel (WhatsApp, email, call script, CRM note). Actions that write to the CRM should need an explicit confirm and leave an audit trail.
5. **Density for power users, calm for new ones.** Keyboard first (palette, slash commands, shortcuts) and compact metadata that can be expanded. Onboarding should be progressive rather than a wall of options.
6. **Honest about limits.** Show what Edge can see (CRM permissions, KB coverage) and what it can't do yet (write to the CRM).

---

## 3. Enhancements

**BE column:** `—` = frontend only · `Proxy` = the BE endpoint exists and needs only a Next `/api` route · `BE-S` = a small change to an existing BE path · `BE-New` = a new API or capability.
**Effort:** S ≤ 2 days · M ≤ 1 week · L > 1 week.

### A. Brand & shell
| ID | What | Why (consultant value) | Where | BE | Eff |
|---|---|---|---|---|---|
| A1 | Point the design tokens at the brand: `--primary` = #006dd6 (hover #0054a5, bright #1877f2), navy #344871 for headings and sidebar. Set a brand-blue `--ring` and add dark-mode variants. Delete `academic`, `gradient-education` and the broken `gradient-brand`. Align `themeColor` with the manifest. | One coherent product that fits the in-flight logo work; removes the black-vs-blue button clash. | `app/globals.css`, `tailwind.config.ts:146-186,420-426`, `app/layout.tsx:26-34` | — | S |
| A2 | Context bar under the header: conversation title (editable inline), pinned-student chip (D1) and DeepThink state. | You always know which case you're working on. | `chat-workspace.tsx:70-91` | — | S |
| A3 | Collapsible and resizable side panes. Dock the sources pane from `lg` with a collapse toggle, and remember the choice per viewer. | Laptops (1024–1279px) lose the docked evidence column today. | `chat-workspace.tsx:93-101`, `use-media-query.tsx:32` | — | M |
| A4 | Branded auth error and login pages: consultant copy, meaningful image `alt`, no raw error codes. | Polish; fewer "is it broken?" pings. | `app/auth/error/page.tsx`, `app/page.tsx:24` | — | S |

### B. Composer & modes
| ID | What | Why | Where | BE | Eff |
|---|---|---|---|---|---|
| B1 | DeepThink (in flight). Add a shortcut (⌘⇧D), show its state in A2, and add a `deepthink` prop to `chat_send`/`chat_done` so C7 can compare quality. | Know when a slow answer was a deliberate choice. | `composer.tsx`, `lib/edge/stream.ts:116` | in flight | S |
| B2 | Slash commands and templates: `/email`, `/whatsapp`, `/call`, `/note`, `/compare`, `/eligibility`, `/checklist`, `/translate ne`. **v1:** prompt templates with placeholders, chosen from a popover. **v2:** send a `task`/`channel` hint the backend respects. | Maps straight onto the backend's `TASKS` (`intent.schema.ts:116`) and `channel` values; power users skip the prose. | `composer.tsx`, new `lib/edge/templates.ts` | v1 —, v2 BE-S (optional hint field on `ChatRequestSchema`, `src/app/http.ts:75`) | M |
| B3 | Starters fill the composer instead of sending, with `{student}` / `{university}` placeholders selected for typing. | The same starter works for real cases. | `chat-thread.tsx:26`, `empty-state.tsx:22` | — | S |
| B4 | Paste-aware chips: when more than ~600 chars are pasted, offer "Review", "Summarise as CRM note" and "Translate to Nepali". | Consultants paste emails and offer letters all day. | `composer.tsx` | — | S |
| B5 | Attach files. **(a)** "Add to knowledge base" through the existing upload, with status polling (`processing`→`ready`); limited to admins or uploaders. **(b)** Per-conversation attachments (transcript, offer letter, visa refusal letter) read only for that turn. | (a) Keeps partner PDFs current. (b) Enables real eligibility and document review. | new `components/chat/attach-*.tsx`, `app/api/knowledge/documents/*` | (a) Proxy, (b) BE-New + privacy decision | (a) M, (b) L |
| B6 | Edit and resend the last user message (↑ in an empty composer edits it). | Fixing a typo shouldn't mean retyping the question. | `user-message.tsx`, `use-chat.tsx:215-224` (reuse `retryLast`) | — | S |
| B7 | Keep composer drafts per session (localStorage; losing them is harmless). | Moving between students doesn't lose text. | `composer.tsx:12` | — | S |

### C. Answer quality & trust
| ID | What | Why | Where | BE | Eff |
|---|---|---|---|---|---|
| C1 | Provenance badges from `kind`/`live`/`sourceKind`: **KB · Partner site · Uploaded doc · Program record · Live web (fetched at…) · CRM**. Also correct the empty-state and panel copy. | "Where did this fee come from?" answered at a glance; live vs indexed matters for policy and fees. | `lib/edge/types.ts:43-55`, `source-card.tsx:70-77`, `citation-chip.tsx`, `empty-state.tsx:34` | — (fields already sent) | S |
| C2 | Split the Cited tab into **Cited in answer** (`citedNumbers`) and **Also consulted**. Drop the raw score, or keep it only behind a debug toggle. | Evidence you can scan quickly; the least noise. | `sources-panel.tsx:77-96`, `lib/edge/citations.ts:28` | — | S |
| C3 | Coverage callout under each answer, built from `done.research`: **"Not in knowledge base"** / "Partly verified: {notes}" / "Research cut short" (`budgetExceeded`/`error`) / "Checked N live pages". | The most important trust signal: tells the consultant when to double-check before advising. | `assistant-message.tsx:127-133`, `types.ts:58-69` | Live: —. History: BE-S (save the `research` summary to message metadata, `service.ts:209-219`) | M |
| C4 | Stop faking history confidence: have `getSession` return `metadata.intent` and map it in. (History `latencyMs` is already done.) | Honest signals on reopened threads. | `use-chat.tsx:39-57`, `types.ts:89-102`; BE `routes.ts:280` | BE-S | S |
| C9 | **Chat retrieval is crowded out by global pages.** This has the same cause as the KB filter bug, but the chat path keeps `includeGlobal` on by design. Live check: a Canada scholarships query retrieved 4 of 4 global pages and 0 of the 293 Canada chunks. Options: (a) reserve slots for the country's own chunks (for example, half of `k`); (b) run a strict pass fused with RRF against the lenient one. Needs an eval run (`bun run eval:*`) before changing the answer path. | Country questions get that country's facts, not generic pages. | BE `src/graph/research.ts:90`, `src/retrieval/multipass.ts` | BE-S + eval | M |
| C5 | KB freshness in the sources panel and empty state ("Partner pages updated 3 days ago"). | Consultants know how current the fee and policy data is. | `sources-panel.tsx`, new `app/api/knowledge/status` | Proxy | S |
| C6 | Usable citation chips: 24px targets, keyboard Enter to preview and a visible "Open" link (not ⌘-click only), plus a hover card with the first 2 lines of the excerpt. | Checking a source without losing your place in the answer. | `citation-chip.tsx:25-62` | — | S |
| C7 | Structured feedback: reason chips (Wrong/outdated · Missing/wrong source · Didn't answer · Too long · Unsafe to send) plus comment; keep the thumbs state across reloads. | Better signal for the eval loop; consultants see their own feedback. | `feedback-buttons.tsx` | BE-S (optional `reason` enum on `FeedbackRequestSchema`; return feedback with history) | M |
| C8 | Readable intent pill: consultant labels for the 29 intents plus the task ("Visa risk · Eligibility"), confidence as text, and a keyboard popover listing destinations and **risk flags** (prior refusal, study gap, urgent timeline, integrity risk). | The flags are useful case cues, and today they're invisible. | `intent-badge.tsx`, `lib/constants.ts:76-79` | — | S |

### D. Student context (the step change)
| ID | What | Why | Where | BE | Eff |
|---|---|---|---|---|---|
| D1 | **Pin a CRM student to a conversation**: a picker (search my contacts), a chip in the header and composer, and the student sent with every turn. | Every question is implicitly about that student; there's no need to repeat the name. | new `components/student/*`, `use-chat.tsx`, `types.ts` | BE-New: (1) contact-search endpoint wrapping the `crm_search_contacts` / `crm_list_my_contacts` MCP tools; (2) `student` on session metadata (extend `UpdateSessionSchema`, `http.ts:173`); (3) the service injects it as "Student under discussion". **Don't reuse `profile`**: it's framed as staff context (`nodes.ts:60`). | L |
| D2 | **Student side panel** (a third right-pane tab): stage, deal, open enquiries, due tasks, last notes, and "Open in CRM". | Call-prep in one glance ("Catch me up" becomes a panel, not a prompt). | `sources-panel.tsx` → workspace right pane | BE-New: `GET /v1/crm/students/:id/overview` wrapping `crm_get_student_overview` (deep links already exist in `src/crm/deep-link.ts`) | M-L |
| D3 | Sessions grouped and labelled by student; the title defaults to the student name plus the topic. | Find "that conversation about Priya's CAS" in seconds. | `session-sidebar.tsx:34-50` | Needs D1 | M |
| D4 | Case-stage and audience chips (e.g. "Offer stage · for parent"). | Confirms Edge understood the situation before you reuse the output. | `intent-badge.tsx` | BE-S: add `stage`/`audience`/`channel`/`signals` to `IntentSummary` (`service.ts:517`) | S |
| D5 | Consultant preferences: office, main destinations, reply language, sign-off, WhatsApp tone. | Drafts come out in your voice; starters match your market. | new settings dialog from `user-menu.tsx` | Proxy (`/v1/profile`, already read by the graph) | S-M |

### E. Actions
| ID | What | Why | Where | BE | Eff |
|---|---|---|---|---|---|
| E1 | Copy menu: **Plain text** (strip `[n]` and markdown) · **WhatsApp** (`*bold*`, bullets, no tables) · **Email** (rich HTML through `ClipboardItem`, sources as footnotes) · **With sources**. | The most frequent action after reading; today it needs manual cleanup. | `assistant-message.tsx:79-88,158-161`, new `lib/edge/format-export.ts` | — | S |
| E2 | Follow-up action buttons on an answer: "Draft email to student" · "WhatsApp message" · "Call script" · "CRM note". Each sends a follow-up using the B2 templates. | One click from research to a message ready to send. | `assistant-message.tsx:134-163` | v1 —, v2 BE-S (channel hint) | S |
| E3 | **Create a CRM note or task** from an answer: a preview, then confirm, then a write with an audit trail. | Closes the loop; no retyping into the CRM. | new action dialog | BE-New: CRM write tools (MCP is read-only today, `src/tools/crm.ts`; flag `crm_write_requested` exists, `intent.schema.ts:110`), plus permission and audit | L |
| E4 | Export the conversation to Markdown or PDF (print stylesheet) with a sources appendix. | Goes on the student file or to a manager. | new `app/chat/[sessionId]/print`, `globals.css` | — | M |
| E5 | Hand a conversation over to a colleague (read-only share). | Leave cover and team escalations. | sidebar row menu | BE-New (sessions are owner-scoped, `routes.ts:266-268`) | L |

### F. Navigation
| ID | What | Why | Where | BE | Eff |
|---|---|---|---|---|---|
| F1 | A row "⋯" menu that's always reachable (touch and keyboard); double-click to rename; drop the `pr-24`; fix the delete copy. | Works on phones and tablets; titles readable. | `session-sidebar.tsx:198,215,285,298-314` | — | S |
| F2 | Full-text search over message content, plus pagination beyond 50. | "Which chat mentioned the Monash scholarship?" | `session-sidebar.tsx`, `use-sessions.tsx:37` | BE-New (search endpoint; list `limit` max is 100, `http.ts:168`) | M |
| F3 | Retention that fits casework: show "expires in 5h" on rows, and make pinned (or student-linked) sessions exempt from the TTL. | Losing a case thread after 72h is the biggest navigation pain. | `session-sidebar.tsx`, `lib/constants.ts:82` | BE-S + a PO/privacy decision (`env.ts:124`) | S-M |
| F4 | **⌘K command palette**: jump to a conversation or student, new chat, toggle DeepThink, open Sources/Programs/Student, run a template, switch theme. | Keyboard-first power use; replaces today's "focus the search box" behaviour. | `use-chat-shortcuts.tsx:110-114`, new `components/command-palette.tsx` | — | M |
| F5 | More shortcuts plus a `?` help sheet: ⌘/ focus composer · ⌘. toggle sources · ⌘⇧C copy last answer · ⌘B sidebar · J/K between answers. | Discoverable density; the composer hint line (`composer.tsx:98-106`) is already full. | `use-chat-shortcuts.tsx` | — | S |

### G. Comparison views
| ID | What | Why | Where | BE | Eff |
|---|---|---|---|---|---|
| G1 | **Programs tab and compare table**: filters for country, level, discipline, intake, max tuition, max IELTS and has-scholarship. Pick 2–4 programs to see a side-by-side table (tuition, intakes, deadlines, IELTS/PTE, scholarships, verbatim evidence, source link), with "Ask Edge about these" and copy as CSV. | Shortlisting is core consultant work; the structured data already exists and the UI just doesn't show it. | new `components/programs/*`, `app/api/knowledge/programs/search` | Proxy (`app.ts:202`, schema `http.ts:120-134`) | M-L |
| G2 | Better answer tables: sticky first column, "copy as CSV", expand to full width. Auto-offered when `intent.task === "compare"`. | Comparison answers become reusable artefacts. | `assistant-message.tsx:65-69` | — | S |

### H. Reasoning transparency
| ID | What | Why | Where | BE | Eff |
|---|---|---|---|---|---|
| H1 | DeepThink reasoning (in flight): keep it visually subordinate, as today. | — | `reasoning-trace.tsx` | in flight | — |
| H2 | (Groups are now titled "Searched the web · Read 2 pages".) Tool rows show what was searched: "Searched KB for 'nursing Melbourne' · 6 results", "Read monash.edu/…", "Checked Priya's tasks". | Shows the research was on target; shows gaps. | `lib/edge/reasoning.ts:20`, `types.ts:35-40` | Query/url: —. Result count: BE-S (`added` already on `ToolCallRecord`, `src/tools/types.ts:22`) | S |
| H3 | "Details" disclosure: stage timings (classify/research/generate), model, rounds. | Power users and support can explain a slow answer. | `reasoning-trace.tsx` | BE-S (timings are in activity meta only, `service.ts:419-425`) | S |
| H4 | Research notes ("what I couldn't find") at the foot of the trace. | Links the trace to the C3 callout. | `reasoning-trace.tsx` | — (live), BE-S for history (with C3) | S |

### I. Onboarding & empty state
| ID | What | Why | Where | BE | Eff |
|---|---|---|---|---|---|
| I1 | Starters grouped by job: **Today · Student case · Research · Draft**, personalised by D5 destinations. **v2:** live counts on "My day" (3 overdue tasks). | Role-relevant; shows CRM ability without explanation. | `empty-state.tsx`, `lib/constants.ts:12-52` | v1 —, v2 BE-New (CRM summary endpoint) | S / M |
| I2 | "Pick up where you left off": pinned and recent conversations on the empty state. | Most sessions resume existing work. | `empty-state.tsx` | — | S |
| I3 | A "What Edge can see" card: your CRM access, KB coverage and freshness (C5), and what it can't do yet (no CRM writes). | Sets trust boundaries on day one. | `empty-state.tsx` | Proxy (status) | S |

### J. Accessibility, mobile, performance, quality
| ID | What | Where | BE | Eff |
|---|---|---|---|---|
| J1 | Replace the article-level `aria-live` with one visually hidden status region: announce the stage, then "Answer ready, N sources". | `assistant-message.tsx:91` | — | S |
| J2 | Target sizes of 24px or more (chips, row actions, feedback) and a 12px minimum for metadata text. | `citation-chip.tsx:37`, `feedback-buttons.tsx:71`, global | — | S |
| J3 | Proper tabs pattern (`aria-controls`, tabpanel, roving tabindex, arrow keys). | `sources-panel.tsx:36-51` | — | S |
| J4 | No colour-only meaning: add a text or icon to the confidence dot and the CRM/KB chips. | `intent-badge.tsx`, `citation-chip.tsx` | — | S |
| J5 | Honour `prefers-reduced-motion` (bounce, spin, smooth scroll). | `assistant-message.tsx:170`, `message-list.tsx:41` | — | S |
| J6 | Theme switcher: add an `aria-label`, render a same-size placeholder before mount, and move it into the user menu to declutter the header. | `theme-switcher.tsx:24,33`, `chat-workspace.tsx:88` | — | S |
| J7 | Mobile: the sources drawer becomes a bottom sheet with a citation preview; a single header overflow menu; composer chips scroll horizontally. | `chat-workspace.tsx:103-112`, `components/ui/sheet.tsx` | — | M |
| J8 | Streaming performance: `memo` each message row, compute `isLastAnswer` once in the list, batch token patches per animation frame, and virtualise threads over ~60 turns. Keep the 184 kB first-load budget. | `message-list.tsx`, `assistant-message.tsx:34`, `use-chat.tsx:149-152` | — | M |
| J9 | Test harness before the big changes: component tests for citations, copy formats and trace folding, plus a Playwright smoke test (stream, cite, copy, reopen). | new `tests/` | — | M |

---

## 4. Phased roadmap

**Phase 1: quick wins (1 week, almost all frontend)**

| Item | Backend |
|---|---|
| A1 brand tokens (pairs with the logo work) · A4 auth pages | — |
| C1 provenance badges · C2 cited/consulted split · C6 chips · C8 readable intent and flags | — |
| C4 honest history | **BE-S**: return `metadata.intent`; FE maps `latencyMs` |
| E1 copy menu (plain / WhatsApp / email / with sources) | — |
| B3 editable starters · B6 edit last message · B7 drafts per session | — |
| F1 row menu and copy fixes · F5 shortcuts and help sheet | — |
| H2 tool queries (FE part) · H4 live research notes | — |
| I2 resume work on empty state | — |
| J1–J6 accessibility fixes | — |

_Result:_ answers become copy-ready and honest about their evidence, with no new APIs. Only one small BE change.

**Phase 2: workspace depth (2–4 weeks)**

| Item | Backend |
|---|---|
| G1 Programs tab and compare table · G2 answer tables | **Proxy** |
| C3 coverage callout, "not in KB" (live) | — (history: **BE-S**) |
| C9 country-balanced chat retrieval (after an eval) | **BE-S** |
| C5 freshness · I3 "What Edge can see" | **Proxy** |
| D5 consultant preferences | **Proxy** `/v1/profile` |
| D4 stage/audience chips · H2 result counts · H3 details | **BE-S** |
| B2 slash templates v1 · E2 draft actions v1 · B4 paste chips | — |
| C7 structured feedback | **BE-S** |
| F4 command palette · A2 context bar · A3 resizable panes | — |
| F3 retention and pinned-exempt | **BE-S** plus a PO decision |
| E4 export/print · J7 mobile · J8 performance · J9 tests | — |
| B5a KB upload UI | **Proxy** |

**Phase 3: the student-centred consultant (4–8 weeks, backend-heavy)**

| Item | Backend |
|---|---|
| D1 pin a student to a session · D2 student panel · D3 group by student | **BE-New**: contact search, student overview, session `student` metadata, prompt injection |
| E3 CRM note/task write-back with confirm and audit | **BE-New**: CRM write tools and permissions |
| F2 full-text session search and pagination | **BE-New** |
| B2/E2 v2 channel/task hints | **BE-S** |
| I1 v2 live "My day" counts | **BE-New** |
| B5b per-conversation attachments · E5 hand over to a colleague | **BE-New** plus privacy review |

**Decisions needed from the PO before Phase 3:**
- **Retention.** The 72h TTL, and whether pinned or student-linked sessions are exempt.
- **CRM write scope.** Notes only, or tasks too? And who approves the writes?
- **Handling of student PII.** This covers attachments and pinned-student data, which end up in `chat_turns` and Langfuse; `src/tools/crm.ts` already flags this privacy concern.
- **Handover model.** Whether conversations can be shared between consultants.

---

## 5. Success measures

Baseline these in Phase 1 using the existing analytics events. New events are marked *new*.

| Goal | Metric | Source | Target direction |
|---|---|---|---|
| Speed | Time to first token (`chat_done.firstTokenMs`, p50/p90); **time to first action**: from sending to a copy, draft or CRM note (*new* `answer_action` with `kind`) | `lib/edge/stream.ts:241`, *new* | ↓ first token (don't regress with DeepThink off); ↓ time to action |
| Trust | Citation verification rate: `source_click` or source "Open" per answered turn; share of copies made after a source was opened | `source_click`, *new* `source_open` | ↑ |
| Trust | Share of answers with a "not in KB" or partial callout; thumbs-down rate on those vs others | C3 + `feedback_click` | Callouts ↑ at first (honesty), then thumbs-down on them ↓ |
| Quality | Thumbs-up ratio; mix of thumbs-down reasons; regenerate rate per answer | `feedback_click` (+ `reason`), `regenerate` | ↑ up-ratio; ↓ "wrong/outdated"; ↓ regenerate |
| Actionability | Actions per session: copy by format, draft actions, exports, CRM notes created | `copy_answer` (+ `format`), *new* events | ↑ |
| Student context (P3) | % of sessions with a pinned student; turns per session that name no student (implied context) | *new* `student_pin` | ↑ |
| Power use | Share of turns started from a template, slash command or palette; shortcut usage | *new* `template_use`, `palette_open` | ↑ among repeat users |
| Adoption | Weekly active consultants; sessions per consultant per day; D7 return rate | activity log | ↑ |
| Accessibility and performance | 0 serious axe violations on /chat; INP under 200 ms while streaming a 40-turn thread; first-load JS at or under 184 kB | CI (J9), Lighthouse | Hold |
