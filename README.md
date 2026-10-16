# Edge — counsellor knowledge assistant (frontend)

Next.js frontend for **Edge**, Expert Education's internal knowledge assistant. A counsellor
signs in with their work Google account and lands directly in a chat that answers from the
company knowledge base (experteducation.com market sites + partner-university pages) with
numbered, checkable citations. The LangGraph / Gemini / MongoDB backend lives in
[`heubert/expert-ai-consultant`](../expert-ai-consultant) ("the Edge API").

There are no intake forms: the assistant runs in the backend's **counsellor mode**
(`mode: "counsellor"`), which answers a colleague densely and factually, cites every
sentence, says "Not in the knowledge base:" instead of guessing and never pitches a
consultation.

## What the workspace does

```
┌──────────────┬──────────────────────────────────────────┬──────────────────┐
│ Conversations│ Thread                                    │ Sources          │
│ + New chat   │ streamed Markdown answer with [n] chips   │ Cited | Search   │
│ Today / …    │ intent badge · latency · copy · feedback  │ excerpt per [n]  │
│ delete       │ composer (Enter = send, Shift+Enter = ⏎)  │ KB search + AU…  │
└──────────────┴──────────────────────────────────────────┴──────────────────┘
```

- **Sign in with Google** (`/auth/login`) → HttpOnly `edge_session` cookie issued by the backend.
- **/chat** — new conversation with counsellor-oriented starter prompts; **/chat/[sessionId]** —
  an existing conversation (history and citations restored from the backend).
- **Citations** — `[n]` in an answer is a chip: click shows the excerpt in the Sources panel,
  ctrl/⌘-click opens the page.
- **Search tab** — direct hybrid retrieval over the knowledge base (no model call), filterable by
  destination; "Ask" drops the page title into the composer.
- **Stop** aborts a streaming answer and keeps the partial text (the backend stores it as a
  `stopped` turn, so it survives a reload). **Copy**, **thumbs up/down**, **Regenerate** (replaces
  the stored answer rather than appending a second one) per answer.
- **Follow-up chips** under the newest answer and a **model-written conversation title** arrive
  as `suggestions` / `session` events after `done`; the composer is usable as soon as `done` lands.
- **Callouts** — paragraphs the model opens with "Not in the knowledge base:" or "General note,
  unsourced:" render as warnings (`lib/edge/callouts.ts`); a cut-short research phase adds one too.
- Responsive: sidebar and sources become drawers below `lg` / `xl`.

## Design system

Tokens live in `app/globals.css` as HSL variables in two layers (raw `--ee-*` Expert brand
scale, then shadcn-style semantic tokens for light and dark), mapped to Tailwind in
`tailwind.config.ts` — use `bg-primary`, `text-heading`, `bg-primary-tint`, `bg-teal-tint`
(CRM evidence), `bg-warning-tint` (caveats) and friends, never raw palette classes. Fonts
(`app/fonts.ts`): General Sans (Expert's brand body face, self-hosted from `app/fonts/`) for
text and UI, Source Serif 4 (`font-heading`) for the greeting, wordmark and answer headings.
Answer prose is themed by `.prose-edge` in `globals.css`. The Expert mark and lockup are inline
SVG in `components/brand/expert-logo.tsx`. Unit tests for the pure modules run with `bun test`.

## Architecture

The browser never calls the Edge API directly. Route handlers under `app/api/*` resolve the
caller from the session cookie and forward with the server key:

| Browser → Next | → Edge API | Notes |
|---|---|---|
| `POST /api/auth/google {credential}` | `POST /auth/google` | sets the `edge_session` cookie |
| `GET /api/auth/me`, `POST /api/auth/logout` | — | cookie only |
| `POST /api/chat {message, sessionId?, newSession?, deepThink?, regenerate?}` | `POST /v1/chat/stream?format=ndjson` + `mode: "counsellor"` | NDJSON piped through; `regenerate` replaces the stored last turn |
| `GET /api/sessions` | `GET /v1/sessions` | sidebar |
| `GET/DELETE /api/sessions/[id]` | `GET/DELETE /v1/sessions/:id` | history incl. `sources` |
| `POST /api/knowledge/search` | `POST /v1/knowledge/search` | Search tab |
| `POST /api/feedback`, `POST /api/events` | `POST /v1/feedback`, `POST /v1/events` | feedback + UI analytics |

Headers added server-side (`lib/auth/server.ts` → `backendHeaders`): `x-api-key: EDGE_API_KEY`,
`x-user-id: <email>`, `authorization: Bearer <edge_session>`.

**Google sign-in only, no anonymous access.** Every route under `/chat` and every `/api/*`
proxy requires a valid, unexpired `edge_session` cookie; `getCaller()`
(`lib/auth/server.ts`) returns `null` for anyone without one, and each proxy route treats
that as `401 unauthorized` before ever calling the backend. There is no "open mode" or
per-browser anonymous identity. If `NEXT_PUBLIC_GOOGLE_CLIENT_ID` or `SESSION_SECRET` is
missing, sign-in and every protected route fail closed (the landing page shows a
"sign-in is not configured" notice) instead of falling back to anonymous chat.

Key code:

- `middleware.ts` — protects `/chat`, `/api/chat`, `/api/sessions`, `/api/knowledge`, `/api/events`, `/api/feedback`; verifies the HS256 cookie with `SESSION_SECRET`.
- `lib/auth/*` — session verification, caller resolution, domain allow-list display.
- `lib/edge/` — `stream.ts` (NDJSON reader), `api.ts` (sessions / search fetchers), `citations.ts` (`[n]` → chips), `server.ts` (proxy helper), `types.ts`.
- `hooks/` — `use-chat.tsx` (thread state, streaming, stop, retry; survives route changes), `use-sessions.tsx`, `use-sources-panel.tsx`.
- `components/chat/*`, `components/sources/*` — workspace shell, sidebar, thread, composer, sources panel, knowledge search.
- `app/chat/layout.tsx` — server-side auth check and the workspace providers.

## Running locally

Prerequisites: Node 20+, a running Edge API (see its README: `bun run dev` on `:3000` with a
populated knowledge base).

```bash
npm install
cp .env.example .env.local     # see below
npm run dev -- -p 3001         # http://localhost:3001
```

`.env.local`:

```
EDGE_API_URL=http://localhost:3000
EDGE_API_KEY=<same as backend API_KEY>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<OAuth web client id>     # empty = open mode (no login, dev only)
SESSION_SECRET=<same as backend SESSION_SECRET, >= 32 chars>
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

Backend `.env` needs `API_KEY`, `CORS_ORIGINS=http://localhost:3001`, `GOOGLE_OAUTH_CLIENT_ID`
(same client id) and `SESSION_SECRET` (same value). In Google Cloud console add
`http://localhost:3001` (and the production origin) as an authorised JavaScript origin of the
OAuth client.

### Sign-in modes

- **Google mode** (`NEXT_PUBLIC_GOOGLE_CLIENT_ID` set at build time): "Continue with Google" via
  Google Identity Services; the backend verifies the ID token (any verified Google account, no
  domain restriction) and returns the session token stored in the HttpOnly cookie.
- **Open mode** (client id unset): no login; every browser gets an anonymous id cookie and the
  proxy calls the backend with `EDGE_API_KEY` only. Use only behind network restrictions.

Checks: `npm run lint` · `npm run build` (standalone output used by the Docker image).

## Deployment

- `Dockerfile` — three-stage build; `NEXT_PUBLIC_*` arrive as build args (CodeBuild passes them
  from Secrets Manager, see `buildspec-prod.yaml`).
- `helm/expert-chatbot-frontend/` — Deployment/Service/Ingress (ALB, `edge.heubertapp.com`),
  ConfigMap for `EDGE_API_URL`; `EDGE_API_KEY`, `SESSION_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  via the external secret. Probes hit `/api/health`.
- Conversation retention is the backend's `SESSION_TTL_HOURS` (72 h by default); raise it there
  if counsellors need longer history.
- PWA: `@ducanh2912/next-pwa`; `/api/*` is excluded from runtime caching.
