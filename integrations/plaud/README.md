# Plaud → KIMO OS

Use the official authenticated Plaud MCP (`list_files`, `get_note`) to read account recordings. No private Plaud endpoints, copied OAuth tokens, public sharing, audio links, or Google Sheets writes are used. Plaud does not currently offer a public personal API: https://support.plaud.ai/hc/en-us/articles/60726890231449-How-can-I-get-API-access-to-my-Plaud-data

## Ingestion

`POST /api/plaud/sync` accepts one recording per request with the existing authenticated Supabase user session, or the existing revocable/expiring KIMO integration key. These credentials belong in the caller's secret configuration, never chat, logs, exports, or the recording JSON. `GET` returns owner-scoped imported IDs, sync state, and revision. The endpoint does not pull Plaud itself: an authenticated MCP caller supplies the recording.

```json
{
  "id": "of_recording_id",
  "title": "Original Plaud title",
  "recordedAt": "2026-10-02T10:45:06",
  "sourceUrl": "https://web.plaud.ai/",
  "summary": "Original generated summary from Plaud",
  "scope": "unassigned",
  "relevanceEvidence": "",
  "drafts": []
}
```

Only set `timezone` if explicitly provided by the source. Preserve the original `start_at` timestamp, even when the summary has a different time. Do not add WIB or UTC to a source time without evidence. Sync timestamps are UTC instants, independently of recording timezone.

`scope` is `studio`, `originals`, `hipmi`, or `unassigned`. DD routing requires explicit source evidence. Set `projectId` only when a unique relevant existing project is confirmed, and only in the same company. Company-level meetings can remain unlinked; no synthetic project is created. HIPMI titles override DD routing and project links. Mixed or ambiguous recordings remain unassigned until reviewed. HIPMI can be read in its separate Sources/Meetings group and cannot be applied as a DD action.

Each draft needs `kind` (`action`/`decision`), `text`, and a verbatim `evidence` excerpt. Extract explicit plans/decisions only; Plaud AI suggestions are not confirmed commitments. Drafts are independent of the executable actions/decisions and reviewed in Sources. Approval requires a same-company project; PIC/deadline fields start empty. No notifications, delegation, or Google writes are triggered by ingestion.

The verified Plaud Web account URL is used when MCP provides no stable recording permalink. Sources displays the recording ID and explains that the URL opens the account. Do not invent a recording deep link or persist an expiring signed storage/audio URL. A verified existing private Plaud app permalink may be supplied later.

## Incremental operation and retry

Read imported IDs before each run; paginate `list_files` until the saved IDs are reached, with an overlap page so recently added/generated notes are not missed. Do not use naive source timestamps as UTC cursors. Process at most five new records per run, sequentially and newest first. Persist an ID only after summary retrieval and storage succeed. A missing summary is deferred and retried next run; failed records remain eligible. Never replace an imported summary or its reviewed drafts automatically; changes require separate review.

The endpoint retries database writes three times, with 250/500ms backoff and a fresh read each time. Writes compare both owner and revision. A response lost after commit is safe to resend: the ID deduplicates the entire meeting/source/draft set. Last success never advances on failure. Failure state is best effort if the database itself is unavailable; the caller must retain its failed queue.

For a trusted operator using the official Supabase MCP, `scripts/prepare-plaud-sync.ts` produces a revision-checked SQL delta from an authenticated owner workspace snapshot and a sanitized Plaud envelope:

```sh
node --import tsx scripts/prepare-plaud-sync.ts artifacts/workspace.json artifacts/recording.json artifacts/sync.sql
```

Execute the generated SQL with the connected Supabase tool against the verified KIMO OS project. A returned row confirms the commit. Zero returned rows require re-reading: if ID exists, this is a duplicate; otherwise retry from the latest revision (at most three attempts). The helper updates only Plaud Sources, Meetings, sync state, and an explicitly linked project's meeting references; Sheets JSON and other business state are preserved. Store private snapshots under ignored `artifacts/`, not Git. A Supabase connector run uses its managed authentication; no service key extraction is needed.

## Schedule gate

First ingest exactly one real recording, read back the saved source/meeting/drafts, then resend and confirm the duplicate creates no new records. Verify no actions, decisions or Sheets state changed. Only then activate the requested hourly Codex heartbeat. It uses the existing official Plaud and Supabase connector authentication, operates locally while Codex can run, and stays quiet on unchanged state. It is not a Vercel Cron job; Vercel does not inherit this desktop Plaud login. Authentication failure stops ingestion and requests official reconnection. The workspace `plaudSync.automatic` remains false because it reports the API's own scheduling capability; the external heartbeat is managed in Codex Automations.
