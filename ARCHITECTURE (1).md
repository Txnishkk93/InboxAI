# InboxAI — Architecture

## 1. Product Summary
InboxAI is a deliverability diagnostic control tower. It scans domain
authentication health, simulates inbox placement, runs a deterministic
root-cause engine over the combined signals, and surfaces prioritized fixes
with alerting. It is an ops-intelligence system, not an AI-model business:
the rules engine is the source of truth; AI is used only to translate
structured findings into plain-English explanation text.

Core promise: "Paste your sending domain, connect one mailbox, and get a
live deliverability score with exact fixes."

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend framework | Next.js (App Router) + TypeScript |
| Styling / components | Tailwind CSS + shadcn/ui + Aceternity UI (motion/structure) |
| Data fetching | TanStack Query |
| Charts | Recharts |
| Backend | Next.js server actions / route handlers (MVP); optional NestJS split later for job isolation |
| Database | Postgres + Prisma |
| Background jobs | Redis + BullMQ (introduced in Phase 3) |
| Auth | Clerk |
| Email sending | Resend |
| DNS parsing | Node `dns` module + custom SPF/DKIM/DMARC parsers |
| Alerts | Slack incoming webhook + email (Resend) |
| AI explanation layer | OpenAI or Anthropic API (optional — deterministic fallback if unset) |
| Hosting (suggested) | Vercel (frontend/API), Railway/Render/Fly (workers + Postgres + Redis) |

---

## 3. High-Level System Diagram (textual)

```
┌──────────────────────┐
│   Next.js Frontend    │  Dashboard: Overview, Domain Health,
│  (React + TanStack Q) │  Inbox Placement, Recommendations,
└──────────┬────────────┘  History, Settings
           │
           ▼
┌──────────────────────┐        ┌──────────────────────┐
│  Next.js API Layer     │◄──────►│   Clerk (Auth)        │
│  (server actions /     │        └──────────────────────┘
│   route handlers)      │
└──────────┬────────────┘
           │
           ├────────────► Postgres (via Prisma) — system of record
           │
           ├────────────► Redis + BullMQ — job queue
           │                 ├─ DNS scan jobs
           │                 ├─ Seed placement test jobs
           │                 ├─ Scoring recalculation jobs
           │                 └─ Alert-check jobs (scheduled + on-completion)
           │
           ├────────────► Resend — outbound email (seed tests + alerts)
           │
           ├────────────► Slack Webhook — alert delivery
           │
           └────────────► LLM API (optional) — explanation text only,
                            never the source of truth for score/severity
```

---

## 4. Auth & Tenant Model

- **Clerk is the sole source of truth for authentication and identity.**
  No passwords, sessions, or credentials are stored in InboxAI's own
  database.
- An internal `users` table stores app-specific profile data only, joined
  to Clerk via a unique `clerkUserId`.
- Multi-tenancy is workspace-based, not user-based. A user can belong to
  multiple workspaces via `workspace_memberships`, with roles: `owner`,
  `admin`, `member`, `viewer`.
- Every workspace-scoped query filters through `workspace_memberships` —
  the system never assumes one user = one workspace (this supports both
  internal teams and agencies managing multiple client workspaces).
- Agencies use one workspace per client; a single user (e.g. an agency
  ops lead) can hold `viewer` or `owner` access across several client
  workspaces.

---

## 5. Data Model

### Core tenancy & onboarding (Phase 1)
- `users` (id, clerkUserId [unique], email, name, createdAt)
- `workspaces` (id, name, ownerId, alertEmail, slackWebhookUrl, createdAt)
- `workspace_memberships` (id, userId, workspaceId, role, createdAt)
- `domains` (id, workspaceId, domainName, status, createdAt, **deletedAt**)
- `mailboxes` (id, workspaceId, domainId, senderEmail, provider, createdAt,
  **deletedAt**)
  - Manually entered sender identity only — no OAuth/inbox sync in v1.

### Diagnostics (Phase 2)
- `dns_scans` (id, **workspaceId**, domainId, triggeredBy, status,
  startedAt, completedAt)
  - `workspaceId` denormalized onto this table directly (not just reachable
    via domainId) for tenant-scoped analytics queries.
- `dns_scan_checks` (id, dnsScanId, checkType [spf|dkim|dmarc|mx|bimi|
  alignment], status [pass|warn|fail], rawValue, parsedDetail json,
  createdAt)
  - Scan run metadata and individual check results are deliberately split
    into two tables for cleaner querying/filtering.
- `score_history` (id, **workspaceId**, domainId, **scoreVersion**,
  totalScore, scoreBreakdown json, rawSignals json, calculatedAt)
  - `scoreVersion` is mandatory on every row. Scoring formula changes are
    additive — historical rows are never recalculated retroactively.
- `recommendations` (id, workspaceId, domainId, title, description,
  severity, confidence, category, status [open|resolved|dismissed],
  createdAt, resolvedAt)

### Placement monitoring (Phase 3)
- `seed_inboxes` (id, provider [gmail|outlook|yahoo], emailAddress,
  **credentialsRef**, isActive, createdAt)
  - `credentialsRef` is a pointer only (env var name / secrets-manager key)
    — raw OAuth tokens or app passwords are never stored in Postgres.
- `placement_tests` (id, **workspaceId**, domainId, mailboxId, testBatchId,
  provider, subjectFingerprint, bodyFingerprint, sentAt, result [inbox|
  promotions|spam|missing|pending], resultDetectedAt, folderRaw)

### Alerting (Phase 4)
- `alerts` (id, workspaceId, domainId, type [score_drop|placement_drop|
  dns_check_failed], severity, message, triggeredAt, channel [email|slack],
  deliveredAt, status [pending|sent|failed], **dedupeKey**)
  - `dedupeKey` (e.g. `${domainId}:${type}`) enforces a cooldown window so
    a persistent issue doesn't re-notify repeatedly.
- `provider_profiles` (id, provider, notes, activeSeedInboxCount)

### Cross-cutting rules
- **Soft deletes**: `domains` and `mailboxes` use `deletedAt`, never hard
  deletes — they're referenced by scans, scores, and history that must
  remain intact.
- **Idempotency**: before starting any scan or placement test batch, check
  for an existing in-flight record for that domain and reuse/return it
  instead of creating a duplicate.

---

## 6. Core Services

### 6.1 DNS Scanner
- Input: `domainId`. Looks up the domain, runs SPF/DKIM/DMARC/MX/BIMI/
  alignment checks via Node's `dns` module and custom parsers.
- Writes one `dns_scans` row + one `dns_scan_checks` row per check type.
- Guarded by the idempotency rule (no duplicate concurrent scans per domain).
- Runs synchronously in Phase 2 (server action); moves to a BullMQ job in
  later phases once cron scheduling is introduced.

### 6.2 Scoring Engine (deterministic — not ML)
Weighted buckets:
- Authentication health — 30%
- Infrastructure health — 20%
- Placement performance — 30% (neutral default until Phase 3 provides real
  placement data)
- Sending pattern risk — 10%
- Reputation/risk signals — 10%

Example point deductions: missing DMARC (-15), SPF lookup depth too high
(-8), DKIM misaligned (-12), Gmail spam rate above threshold (-20), Outlook
inbox drop over 7 days (-10).

Every calculation is versioned (`scoreVersion`) and written to
`score_history` with full breakdown + raw signal inputs, so formula changes
never distort historical trend charts.

### 6.3 Placement Monitor
- Sends a test email from the workspace's configured sender identity to
  all active `seed_inboxes` (Gmail + Outlook first; Yahoo + custom domains
  added in Phase 4).
- A BullMQ worker polls each seed inbox (IMAP or provider API) after a
  delay and classifies the landing folder as inbox / promotions / spam /
  missing.
- Guarded by the idempotency rule (no duplicate concurrent test batches per
  domain).
- Feeds the "Placement performance" scoring bucket once real data exists.

### 6.4 Root-Cause / Recommendation Engine
A rules engine (not AI) that maps combinations of DNS check results and
placement results to ranked, structured recommendations — e.g. "SPF/DKIM/
DMARC all pass but Gmail placement is spam" → "likely sending pattern or
content issue, not authentication" (high severity). Each recommendation is
traceable back to the specific check/test records that triggered it.

### 6.5 AI Explanation Layer
The only place an LLM touches the product. Takes a recommendation's
structured fields (title, description, severity, related checks) and
generates a three-part plain-English card: what's wrong / why it matters /
what to do next. If no LLM API key is configured, the system falls back to
a deterministic string-template explanation — the product remains fully
functional with zero LLM configuration. The LLM never decides severity,
confidence, or whether a recommendation exists.

### 6.6 Alerting Engine
After every scan or placement test completes (manual or scheduled), an
alert-check step compares the new result to the prior one for:
- `score_drop` — total score drops more than a threshold vs. prior
  `score_history` row
- `placement_drop` — a provider's result regresses (e.g. inbox → spam)
  vs. the prior batch
- `dns_check_failed` — any check flips from pass → fail vs. the prior scan

Before creating an alert, the engine checks `dedupeKey` against a cooldown
window (default 24h) — if the same issue already alerted recently, the new
one is suppressed (logged, not silently dropped) rather than re-notifying.
Delivery goes out via Resend (email) and/or Slack webhook, with delivery
status tracked on the `alerts` row itself (not fire-and-forget).

### 6.7 Scheduler
BullMQ repeatable jobs (introduced in Phase 4) drive:
- Daily DNS rescans per domain
- Placement tests every 2-3 days per domain (deliberately less frequent
  than DNS scans, since seed test volume has its own reputation cost)

Scheduled jobs call the exact same service functions as manual triggers —
no duplicated logic path.

---

## 7. Frontend Architecture

### Pages (sidebar nav, fixed)
1. **Overview** — Bento Grid layout (reserved for this page only): large
   score cell, top recommendations cell, quick-stats cells.
2. **Domain Health** — monospace table of SPF/DKIM/DMARC/MX/Alignment/BIMI
   checks, sticky header, manual rescan CTA.
3. **Inbox Placement** — provider × seed-inbox result grid, trend
   sparkline per provider, manual "Run Test" CTA.
4. **Recommendations** — severity-sorted list, each card split into
   what's-wrong / why-it-matters / what-to-do-next.
5. **History** — score trend chart (Recharts) with alert markers.
6. **Settings** — domain/sender management, Slack webhook + alert email
   config, workspace membership.

### Design system (see companion UI spec)
- Monochrome base palette + one reserved accent color for critical/fail
  states only. Pass = grayscale, never green. Warning = grayscale with
  heavier weight/border, no color spent.
- Typography: Instrument Serif (display) + IBM Plex Sans (body) + IBM Plex
  Mono (numeric/technical data).
- Accessibility: 16px minimum body text, WCAG AA contrast in both themes,
  44px touch targets, visible focus states, explicit empty/loading/error
  state design on every data view.
- Motion: one entrance animation per page (200-400ms), no looping/parallax/
  animated backgrounds on data-dense pages; Aceternity's Bento Grid limited
  to Overview only, Spotlight/Border-Beam limited to the single primary CTA
  per page.

### Data fetching
TanStack Query handles polling for in-progress scans/tests (pending →
complete state transitions) and caching for dashboard reads.

---

## 8. Security & Data Handling

- No raw credentials in the database, ever. Seed inbox and any future
  provider credentials are referenced by pointer (`credentialsRef`) and
  resolved via environment variables or a secrets manager (Vercel
  encrypted env vars / AWS Secrets Manager / Doppler recommended once
  Phase 3 seed inboxes go live in production).
- Clerk owns all authentication; the app never handles passwords directly.
- Soft deletes preserve referential integrity for domains/mailboxes tied
  to historical scans and scores.
- Workspace-scoped access control enforced at the query layer via
  `workspace_memberships` on every read/write.

---

## 9. Build Phases (reference)

| Phase | Scope |
|---|---|
| 1 | Auth, workspaces, workspace memberships, domain/mailbox onboarding, dashboard shell with empty states |
| 2 | DNS scanner, deterministic scoring engine (v1), recommendation generation, AI explanation layer (with template fallback) |
| 3 | BullMQ/Redis introduced, Gmail + Outlook seed inbox placement testing, scoring engine updated to v2 (placement bucket activated) |
| 4 | Cron scheduling, alerting engine with dedupe/cooldown, Yahoo + custom domain providers, Settings-based alert configuration |

Each phase has its own detailed Cursor/Antigravity build prompt with an
explicit "Done Means Done" checklist and "Explicitly Out of Scope" list —
phases are meant to be run and verified sequentially, not all at once.

---

## 10. What Is Deliberately Out of Scope (indefinitely, unless revisited)
- Self-serve seed inbox provisioning (seed inboxes are manually bootstrapped
  by the developer)
- OAuth-based inbox syncing/reading in v1 (sender identity is manual entry
  only)
- ML-based scoring (the rules engine is the permanent truth layer)
- Billing/plans/usage limits (would be a distinct future phase)
- Agency/multi-client dashboard mode beyond basic multi-workspace
  membership
- Any mailbox provider beyond Gmail, Outlook, Yahoo, and a small number of
  custom domains
