# KIMO OS

A personal executive command center for Kimo Rizky and Double Deer Group. This V1 is a working frontend prototype with local demo mode and an optional Supabase cloud mode with realistic sample data, anchored to **3 October 2026**. Meeting times use **Asia/Jakarta (WIB)**.

## What was built

- Today: concise CEO brief, ranked top three priorities, decision inbox, group portfolio, meetings, risks, cash exception, and people follow-ups.
- Priorities: Today / This week / Later, completion and delegation.
- Decisions: Needs Kimo / Waiting for others / Decided, contextual options and recorded outcomes.
- Projects: all 11 requested sample projects, grouped by company, with health, ownership, blockers, and next action.
- People: responsibilities, commitments, expected updates, and delegated actions.
- Meetings: upcoming and recent sample meetings, summaries, linked decisions, commitments, actions, risks, and follow-ups.
- Inbox: review, delegate, convert to action, convert to decision, and archive.
- Search: local project, person, decision, and commitment matching; suggested questions and overdue/approval shortcuts. No simulated AI answers.
- Company filters, responsive mobile navigation, keyboard search (Cmd/Ctrl+K), accessible focus-trapped dialogs, Escape to close, local persistence, and sample reset.

## Run

Requires Node.js 20.9+ and npm.

```sh
cd /workspace/kimo-os
npm ci
npm run dev
```

Open http://localhost:3000. For a production server:

```sh
npm run build
npm run start
```

In this managed workspace, npm's default home cache is unavailable; use `npm ci --cache /tmp/kimo-npm` if needed.

## Architecture and file structure

Next.js App Router, React, strict TypeScript, Lucide icons, and a custom CSS design system. CSS variables define restrained surfaces, typography, and status colors; no UI framework is required for V1.

```text
src/
  app/                 App entry, metadata, responsive design tokens and styles
  components/
    command-center.tsx Application shell and workflow state
    today.tsx          Executive brief and exception dashboard
    workspace-views.tsx Secondary executive views
    detail-dialog.tsx  Contextual project, decision, meeting, and action details
    ui.tsx             Shared badges, avatars, headings, empty states, dialogs
  domain/models.ts     Company, Project, Person, Commitment, Decision,
                       Meeting, Action, Risk, InboxItem, and Workspace types
  data/mock.ts         Realistic sample business data
  services/workspace.ts WorkspaceService, persistence, ranking, inbox conversion
  integrations/adapters.ts Source records and IntegrationAdapter contract
  ai/contracts.ts      Intelligence service and provenance contracts
 tests/
  workspace.test.ts    Ranking and inbox workflow unit tests
  browser.mjs          Chromium workflow and responsive smoke checks
```

`WorkspaceService` is the persistence boundary. Replace its browser implementation with an API-backed service to migrate to PostgreSQL/Supabase. Inbox transformations are pure functions and maintain project links. Repeated conversion does not duplicate the derived action or decision. Re-delegating an existing derived action updates ownership.

`IntegrationAdapter` isolates source ingestion. `IntelligenceService` defines future briefing, extraction, and search output with source references, confidence, and review state. Neither interface calls an external service in this version.

Priorities are ordered by explicit sample scores, filtered to open actions and the active company. These are deterministic prototype rankings, not an AI or full business-signal scoring engine.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Browser checks require a running app and installed Chromium:

```sh
npm run start
# In another terminal:
npm run test:browser
```

`CHROMIUM_PATH` can override `/usr/bin/chromium`. The smoke suite verifies recorded decisions survive reload, inbox conversion, delegation visibility, search results, and all primary views at 1440px and 390px widths with no horizontal overflow or browser runtime errors. Screenshots are saved to `/tmp/kimo-desktop.png` and `/tmp/kimo-mobile.png`.

## Intentionally postponed

Live connectors, production AI, dynamic business-signal ranking, source ingestion jobs, automated follow-up resolution, and realtime push synchronization. Sample project health and briefs are manually authored fixtures; recording a decision does not infer project health or update unrelated source facts. No email, calendar changes, or messages are sent. Demo data is scoped to a browser; configured cloud data is scoped to the authenticated owner. Both can be reset in Settings.

## Next milestone

Introduce persistent storage and one read-only Google Calendar connector with source provenance and a reviewable ingestion flow. Then add Plaud summaries and human-reviewed commitment/decision extraction. This milestone is proposed only; it is not implemented.

## V1.1 — Database, login, and device access

Supabase persistence and invited-account email-link login are implemented. With both public Supabase environment variables set, the app gates access behind authentication and uses a cloud workspace service. With neither set, it runs the existing local demo. See [the activation guide](supabase/SETUP.md) for database migration, owner account, email delivery, environment variables, and hosting steps.

New files:

- `src/components/workspace-access.tsx`: sign-in, restored sessions, and sign-out.
- `src/lib/supabase.ts`: configured public client and explicit cloud/demo modes.
- `src/services/cloud-workspace.ts`: persistence and revision conflict handling.
- `src/services/validation.ts`: snapshot validation before rendering or saving.
- `supabase/migrations/202610030001_workspace.sql`: owner access rules and constrained save RPC.
- `.env.example`: public client configuration template.
- `tests/cloud-workspace.test.ts`, `tests/database.test.ts`, and `tests/browser-cloud.mjs`: cloud persistence, real SQL access rules, and mocked provider browser checks.

Changes are confirmed in the UI only after a successful save. On conflict, reload the latest version; failed writes leave the displayed workspace unchanged. Settings offers refresh and device-local sign-out. Cloud synchronization occurs on loading/reloading, not through realtime subscriptions.

Additional commands:

```sh
npm run test:cloud     # Browser tests using simulated Supabase responses
npm run preview:build # Regenerate downloadable LOCAL HTML preview
```

The cloud implementation is not activated against a live provider in this session. The original connector/AI recommendations remain future work; first activate and verify this persistence milestone using the guide.

### Live business Sheets → KIMO OS

Sources → **Live Google Sheets — DDO / DDS** reads the original three configured spreadsheet IDs. Excel uploads are optional and never act as a live sync source. Known operational tabs supply projects/tasks/leads/commercial records; copied tabs, logs and financial summaries do not become projects. The duplicated commercial Seedlist is excluded from active lead counts.

1. **Read & review live sheets**. The preview shows proposed cell changes, source counts and accounting caveats. Reconnect with **Sheets edit permission** if the existing Google connection only has readonly access. Enable `https://www.googleapis.com/auth/spreadsheets` in Google Auth Platform Data access if required by the consent configuration. No additional SQL migration or environment variable is needed.
2. **Back up & refine source sheets** backs up affected tabs into new Google spreadsheets, persists backup links before source writes, rechecks the source fingerprint, then updates source cells in per-workbook atomic batches. The three workbook changes are not collectively atomic; on partial failure, backup links remain available and preview/retry applies only remaining changes. Review financial warnings: tax/profit definitions are not inferred. Backups contain affected tabs, not complete copies of every unrelated tab/report.
3. Read the fresh preview, export an OS backup and activate live sync. Revision-checked writes replace sample/source-managed entities while retaining manual history linked to retained projects. Source row UUIDs preserve identity after sorting; native duplicate IDs are preserved. Subsequent new rows receive UUIDs only after backup; other new formula/header changes stop sync for review.

The OS checks on open, foreground, Google Sync and every five minutes **while the app is open and visible**. This is not an unattended scheduled server job. Source-managed task status/PIC must be edited in Google Sheets. KIMO decisions, meetings and other manual records remain in OS; OS edits are not automatically written back to Google. Pause disables background sync; file import is hidden while live sync is enabled. Missing/invalid required operational sources, a changed preview, failed backup, source refinement requirements or a concurrent workspace revision prevent replacement. The live reader limits imported tabs to 2,000 populated rows and explicitly rejects larger datasets.
