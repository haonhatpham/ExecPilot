# ExecPilot

ExecPilot is a full-stack AI SaaS that runs autonomously using the same architecture as OpenClaw, powered by Next.js 16, React 19, and the Vercel AI SDK with the Claude API. The agent runs on a 15-minute heartbeat to triage your inbox, draft replies, schedule calendar events, and generate action items—without you having to lift a finger.

## Features

- **AI Email Analysis** — Analyzes unread emails with `anthropic/claude-sonnet-4` and returns structured output (Zod).
- **Smart Draft Replies** — Creates Gmail draft replies when the AI determines a response is needed (`needsReply`).
- **Task Extraction** — Each `actionItems[]` item is stored as a record in the `tasks` table.
- **Calendar Integration** — Fetches upcoming events (next 24 hours) to reduce duplicates and creates new events when the AI requests them.
- **Autonomous Agent** — `POST /api/agents/run` endpoint:
  - Manual run (requires Clerk sign-in)
  - Cron run (authorized via `Authorization: Bearer <CRON_SECRET>` header)
- **Monitoring Dashboard** — `/monitoring` shows the last 20 runs and email-level details.
- **Token Encryption** — OAuth tokens are encrypted with AES-256-GCM before being stored in the database.

## Tech Stack

| Layer        | Technology                                       |
| ------------ | ------------------------------------------------ |
| Framework    | Next.js 16 (App Router)                          |
| Language     | TypeScript 5                                     |
| Auth         | Clerk (`@clerk/nextjs`)                          |
| AI           | `ai` package + model `anthropic/claude-sonnet-4` |
| Database     | PostgreSQL + Drizzle ORM                         |
| Integrations | Gmail API + Google Calendar API                  |
| UI           | Tailwind CSS + shadcn/ui + Radix                 |

## Project Structure

```text
app/
  (main)/
    dashboard/              # Dashboard + stats + Run Agent button
    monitoring/             # Monitoring agent_runs history + actionsLog
    settings/               # Gmail/Calendar connection status (UI)
  api/
    agents/
      run/route.ts          # Agent execution endpoint (manual + cron)
  app/layout.tsx            # Root layout + ClerkProvider
  page.tsx                  # Landing page

components/
  agents/
    email-detail.tsx        # UI for action items / draft reply details
    run-agent-button.tsx   # Button that calls POST /api/agents/run

db/
  schema.ts                # Drizzle schema (users, integrations, tasks, agent_runs)
  queries.ts               # CRUD/query helpers used by the agent + UI
  index.ts                 # Drizzle client initialization

lib/
  agent.ts                 # Orchestrates an agent run
  agents/
    gmail.ts               # Gmail: fetch unread, mark as read, create draft
    calendar.ts            # Calendar: fetch upcoming, create event
    process-email.ts      # AI email analysis + structured output extraction
  google.ts                # OAuth scopes + auth URL generation
  google-client.ts         # Gmail/Calendar client creation + token refresh
  encryption.ts            # AES-256-GCM encrypt/decrypt for tokens
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Clerk account (publishable key + secret key)
- Google Cloud project with **Gmail API** and **Google Calendar API** enabled
- Anthropic/AI gateway credentials (so the `ai` package can call `anthropic/claude-sonnet-4`)

### 1) Install dependencies

```bash
npm install
```

### 2) Create `.env.local`

Create a `.env.local` file in the repo root and fill in the variables below (do not commit secrets):

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Encryption input used to derive the AES-GCM key
ENCRYPTION_KEY=your-secret-string

# AI gateway (provider configuration for the `ai` package)
AI_GATEWAY_API_KEY=your-anthropic-or-gateway-key

# Cron authentication (required for cron mode of /api/agents/run)
CRON_SECRET=your-cron-secret
```

### 3) Set up the database

```bash
npx drizzle-kit push
```

### 4) Run dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Database Schema

- `users`
  - stores Clerk profile data (`clerkId`), `agent_enabled` status, onboarding flag
- `integrations`
  - stores encrypted OAuth tokens for `gmail` and `google_calendar`
- `tasks`
  - tasks created from AI-extracted `actionItems`
- `agent_runs`
  - agent execution history
  - `actions_log` (jsonb) stores per-email details: summary, priority, category, draft reply, action items, and counts for tasks/drafts/events

## How the Agent Works

1. **Trigger** — Call `POST /api/agents/run`.
   - Manual: user must be signed in with Clerk, and `user.agentEnabled === true`.
   - Cron: request includes `Authorization: Bearer <CRON_SECRET>` → the server selects eligible users (agent enabled + Gmail integration connected).
2. **Create run log** — Create a record in `agent_runs`.
3. **Gmail client** — If Gmail is not connected or the token is invalid/expired → mark the run as `failed` with summary `Gmail not connected`.
4. **Fetch unread emails** — Gmail query:
   - `is:unread newer_than:7d`
   - `maxResults=10`
   - Uses `full` message format, prefers `text/plain` (falls back to HTML), truncates email body beyond 5000 chars.
5. **Calendar context (optional)** — If Calendar is connected:
   - Fetch upcoming events within ~24 hours (max 20)
   - Use them as prompt context to reduce duplicates.
6. **AI analysis (Claude Sonnet 4)** — `generateText` + Zod output:
   - `summary`, `priority` (`low|medium|high`), `category`
   - `actionItems[]` (title/description/dueDate)
   - `needsReply` + `draftReply`
   - `calendarEvents[]` (title/description/date/startTime/endTime)
7. **Take actions**
   - Create tasks for each `actionItems` entry (including `dueDate` when present; `createdByAgent=true`).
   - If `needsReply && draftReply` → create a Gmail draft in the correct `threadId`.
   - If `calendarEvents` exist → create events on `primary` calendar:
     - no `startTime` → all-day event
     - missing `endTime` → default to `start + 1h`
   - Mark emails as read (remove the `UNREAD` label).
8. **Complete run log** — Aggregate the results:
   - status `success` if at least 1 email was processed successfully; otherwise `failed`.

## API Routes

| Method | Route             | Description                        |
| ------ | ----------------- | ---------------------------------- |
| `POST` | `/api/agents/run` | Execute agent run (manual or cron) |

### `/api/agents/run`

- **Manual mode**
  - requires Clerk auth
  - additionally checks `user.agentEnabled`
- **Cron mode**
  - bypasses Clerk auth if the `Authorization` header matches `Bearer ${CRON_SECRET}`
  - selects eligible users via `getUsersWithAgentEnabled()` (agent enabled + Gmail integration connected)

## Connect Gmail & Google Calendar (Google OAuth)

The app expects Google OAuth endpoints to handle the consent flow and persist encrypted tokens into the `integrations` table:

- `/api/auth/google` (start OAuth and redirect to Google)
- `/api/auth/google/callback` (handle callback and save tokens)

Once those endpoints are in place, go to `/settings` and click `Connect` for `Gmail` and/or `Google Calendar`. After completing Google OAuth and saving tokens, you can run the agent to:

- read unread emails and create draft replies (when needed)
- generate action items in the database
- create Google Calendar events (when emails contain time-sensitive information)

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm start        # Start production server
npm run lint     # ESLint
```

## Security

- **Token encryption at rest** — AES-256-GCM with a random IV; the key is derived from `ENCRYPTION_KEY` via SHA-256.
- **Automatic refresh** — Refresh tokens are refreshed ~5 minutes before expiration.
- **Route protection**
  - Manual run: protected by Clerk auth
  - Cron run: authenticated via `CRON_SECRET`
