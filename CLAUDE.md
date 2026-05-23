# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (runs prisma generate first)
npm run build        # production build (runs prisma generate first)
npm run lint         # ESLint via next lint
npm run cli:voice    # run voice agent in terminal (tsx)
npm run cli:text     # run text agent in terminal (tsx)
npx prisma studio    # open DB browser
npx prisma db push   # apply schema changes to dev.db
npx prisma db seed   # seed shops from src/lib/db/seed-shops.ts
```

Node ≥ 24 is required (enforced in package.json engines).

After pulling, run `npm install` — the `postinstall` hook regenerates the Prisma client and rebuilds `better-sqlite3`.

## Architecture

### Multi-tenant voice agent

This is a Next.js 15 app that serves an embeddable voice agent. Tenants are defined statically in [src/data/tenants.json](src/data/tenants.json) and loaded at module init by [src/lib/tenants/registry.ts](src/lib/tenants/registry.ts). Each tenant has an `agentType` (`support` | `complaints` | `reviews`), TTS settings, knowledge base entries, and optional per-tenant OpenAI key.

### Three access paths into `/voice`

1. **Embed via iframe** — anonymous or token-authenticated. Query params `?tenant=<id>&token=<secret>&shop=<branchCode>` are forwarded as `x-embed-*` headers on every API call. The client sends these from `use-voice-agent.ts` boot effect.

2. **Agent login** — shop agents log in at `/agent-login`, authenticate against the `User` table via `/api/agent-auth`, and get an `app_session` cookie. The middleware at [src/middleware.ts](src/middleware.ts) redirects `/voice` to `/agent-login` unless a valid agent session exists.

3. **Dashboard** — admins and managers log in at `/dashboard/login`. Admins see all shops; managers are scoped to their `shopId`. Dashboard data is served by `/api/dashboard` after role check.

### Auth system

- Sessions are HMAC-signed JWTs (no library), implemented in [src/lib/auth/session.ts](src/lib/auth/session.ts). Cookie name: `app_session`. Secret: `SESSION_SECRET` env var.
- Roles: `agent` | `manager` | `admin`. `agent` role can only access `/voice`; `manager` and `admin` access `/dashboard`.
- Embed API auth is separate: `requireEmbedApiAuth()` in [src/lib/security/embed-auth.ts](src/lib/security/embed-auth.ts) validates `x-embed-tenant` + `x-embed-token` headers (or falls back to domain matching / API key). Disabled by default (`EMBED_AUTH_ENABLED=false`).
- Tenant resolution priority: `tenantId + token` → `x-api-key` → `Referer` domain.

### Voice pipeline (`useVoiceAgent` hook)

The hook in [src/hooks/use-voice-agent.ts](src/hooks/use-voice-agent.ts) drives the full conversation cycle:

1. **Boot** — fetches `/api/config` to get voice, language, agent name, greeting
2. **Record** — `useAudioRecorder` (MediaRecorder → WebM blob) or `useSpeechRecognition` (Web Speech API, off by default)
3. **Transcribe** — POST blob to `/api/transcribe` → OpenAI Whisper
4. **Chat** — POST history to `/api/chat` → SSE stream
5. **TTS** — sentences arrive via SSE `{ sentence }` events → `useAudioPlayer` fetches `/api/speak` → streams audio; or ElevenLabs depending on tenant config
6. **End** — on `[END_CALL]` token → POST to `/api/summarize` (persists Review + Lead to SQLite, sends email)

State is managed by a `useReducer` in the hook with phases: `connecting → idle → listening → transcribing → thinking → speaking → ended | error`.

### Hidden token protocol

The LLM appends structured tokens to every response that are never shown to the user:

- `[LEAD:{...}]` — contact info captured during conversation
- `[REVIEW:{...}]` — sentiment/category classification
- `[END_CALL]` — signals conversation is complete

The `/api/chat` route strips these tokens from the visible text and emits them as separate SSE events (`{ lead }`, `{ review }`, `{ done, endCall }`). See `findJsonToken` / `stripTokens` in [src/app/api/chat/route.ts](src/app/api/chat/route.ts).

### Agent prompts

`buildSystemPrompt()` in [src/lib/config/prompt.ts](src/lib/config/prompt.ts) selects one of three prompt builders based on `agentType`. Each prompt embeds language rules, shop context (branch name/city — so the agent never asks which branch), knowledge base, and the hidden token schema. The 5-exchange conversation cap is enforced inside the prompt.

### Database

SQLite via Prisma + `better-sqlite3`. Schema: `Shop → Review → Lead`, `Shop → User`. The `db` export in [src/lib/db/client.ts](src/lib/db/client.ts) is a lazy proxy to prevent reconnects on Next.js hot-reload. A second `rawDb` proxy loads `sqlite-vec` for vector operations. On Vercel, the DB file path is resolved from `DATABASE_URL` env var via [src/lib/db/path.ts](src/lib/db/path.ts).

### UI component

`NexusAgent` in [src/components/voice-agent/nexus-agent.tsx](src/components/voice-agent/nexus-agent.tsx) is the main UI. It wraps `NexusAgentInner` in a session-key pattern so reset remounts the component cleanly without a page reload. It enforces a 120s session cap and a 60s per-turn recording cap, both with countdown SVG arcs. Color theme tracks the `--nx-accent` CSS variable via `MutationObserver`.

## Environment variables

```bash
# Required: at least one LLM provider
OPENAI_API_KEY=
GROQ_API_KEY=          # free alternative for chat; Whisper still requires OpenAI

# Optional TTS
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=

# Auth
SESSION_SECRET=        # HMAC key for session tokens (defaults to insecure fallback)
EMBED_AUTH_ENABLED=    # true | false (default false)

# Embed tenant config (when EMBED_AUTH_ENABLED=true)
EMBED_TENANTS=         # JSON array — see EMBED_INTEGRATION.md

# Email (per-tenant, referenced by name in tenants.json)
GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=

# DB (Vercel)
DATABASE_URL=          # file path to SQLite, e.g. file:/tmp/dev.db
ALLOWED_FRAME_ANCESTORS=  # comma-separated iframe parent origins
```

## Key files

| Purpose | Path |
|---|---|
| Tenant definitions | `src/data/tenants.json` |
| Tenant types | `src/lib/tenants/types.ts` |
| Tenant registry & resolution | `src/lib/tenants/registry.ts` |
| System prompt builders | `src/lib/config/prompt.ts` |
| Voice agent hook | `src/hooks/use-voice-agent.ts` |
| Main UI component | `src/components/voice-agent/nexus-agent.tsx` |
| Chat SSE route | `src/app/api/chat/route.ts` |
| Summarize + persist route | `src/app/api/summarize/route.ts` |
| Session auth | `src/lib/auth/session.ts` |
| Embed auth guard | `src/lib/security/embed-auth.ts` |
| DB client | `src/lib/db/client.ts` |
| Dashboard data queries | `src/lib/db/dashboard-query.ts` |
| Middleware (route guards) | `src/middleware.ts` |

## Adding a new tenant

1. Add an entry to `src/data/tenants.json` following `TenantConfig` in `src/lib/tenants/types.ts`
2. Add a matching `Shop` row in the DB (`tenantId` must match the JSON `id`)
3. If using per-tenant OpenAI key, set `openaiApiKey` in the JSON entry
4. Run `npx prisma db seed` or insert manually via Prisma Studio
