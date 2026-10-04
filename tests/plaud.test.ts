import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace } from "../src/services/import-workspace";
import {
  ingestPlaud,
  reviewPlaudDraft,
  syncPlaud,
  parsePlaudRecording,
  type PlaudRecording,
} from "../src/services/plaud";
import { isWorkspace } from "../src/services/validation";
import { GET, POST } from "../src/app/api/plaud/sync/route";
import {
  executiveWorkspace,
  scopeExecutive,
} from "../src/presentation/hierarchy";
const recording: PlaudRecording = {
  id: "of_test_1",
  title: "Rapat pipeline DD Studio",
  recordedAt: "2026-10-02T10:45:06",
  sourceUrl: "https://web.plaud.ai/",
  scope: "studio",
  relevanceEvidence: "Diskusi fokus pada studio.",
  summary: "Pipeline perlu diperbarui.",
  drafts: [
    {
      kind: "action",
      text: "Update pipeline",
      evidence: "Update pipeline dengan angka terbaru.",
    },
  ],
};
const now = "2026-10-04T06:00:00.000Z";
test("Plaud endpoints reject unsigned callers before database access", async () => {
  for (const handler of [GET, POST]) {
    const response = await handler(new Request("https://kimo.test/api/plaud/sync", {
      method: handler === GET ? "GET" : "POST",
    }));
    assert.equal(response.status, 401);
  }
});
test("Plaud IDs deduplicate repeated sync and preserve original timestamp and unrelated data", () => {
  const current = emptyWorkspace();
  current.sourceSheets = [
    { id: "sheet", file: "DDO", title: "Tasks", rows: [["keep"]] },
  ];
  const next = ingestPlaud(current, recording, now);
  assert.equal(isWorkspace(next), true);
  assert.equal(next.meetings[0].date, recording.recordedAt);
  assert.equal(next.meetings[0].sourceTimezone, undefined);
  assert.deepEqual(next.sourceSheets, current.sourceSheets);
  assert.deepEqual(next.actions, []);
  assert.deepEqual(next.decisions, []);
  assert.equal(ingestPlaud(next, recording, now), next);
  assert.equal(next.plaudSources?.[0].drafts[0].status, "Review");
  assert.equal(current.meetings.length, 0);
});
test("HIPMI stays separate even with an incorrect DD routing envelope", () => {
  const next = ingestPlaud(
    emptyWorkspace(),
    {
      ...recording,
      title: "HIPMI Jaya Yellow Pages",
      projectId: "studio-project",
    },
    now,
  );
  assert.equal(next.meetings[0].scope, "hipmi");
  assert.equal(next.meetings[0].project, "");
  assert.equal(next.meetings[0].company, undefined);
  assert.equal(
    scopeExecutive(executiveWorkspace(next), "studio").meetings.length,
    0,
  );
  assert.equal(executiveWorkspace(next).meetings.length, 1);
});
test("unlinked but relevant meetings survive presentation and company filters", () => {
  const next = ingestPlaud(emptyWorkspace(), recording, now);
  assert.equal(
    scopeExecutive(executiveWorkspace(next), "studio").meetings.length,
    1,
  );
  assert.equal(
    scopeExecutive(executiveWorkspace(next), "originals").meetings.length,
    0,
  );
});
test("signed credentials, missing evidence and mismatched projects are rejected", () => {
  assert.throws(() =>
    parsePlaudRecording({
      ...recording,
      sourceUrl: "https://web.plaud.ai/?token=secret",
    }),
  );
  assert.throws(() =>
    parsePlaudRecording({ ...recording, relevanceEvidence: "" }),
  );
  assert.throws(() =>
    ingestPlaud(emptyWorkspace(), { ...recording, projectId: "unknown" }, now),
  );
});
test("review is explicit, idempotent, leaves unconfirmed owner and deadline empty", () => {
  const current = emptyWorkspace();
  current.projects.push({
    id: "p",
    name: "Pipeline",
    company: "studio",
    owner: "",
    deadline: "",
    health: "Watch",
    priority: 50,
    status: "Active",
    latestUpdate: "",
    nextAction: "",
    blockers: [],
    people: [],
    meetings: [],
    documents: [],
  });
  const next = ingestPlaud(current, recording, now);
  const id = next.plaudSources![0].drafts[0].id;
  assert.throws(() =>
    reviewPlaudDraft(next, recording.id, id, { action: "apply" }),
  );
  const reviewed = reviewPlaudDraft(next, recording.id, id, {
    action: "apply",
    projectId: "p",
  });
  assert.equal(reviewed.actions[0].owner, "");
  assert.equal(reviewed.actions[0].dueDate, "");
  assert.equal(
    reviewPlaudDraft(reviewed, recording.id, id, {
      action: "apply",
      projectId: "p",
    }),
    reviewed,
  );
  assert.equal(isWorkspace(reviewed), true);
});
test("retry rereads latest revision, avoids duplicates after an ambiguous write", async () => {
  let current = emptyWorkspace(),
    revision = 1,
    writes = 0;
  const result = await syncPlaud(
    {
      read: async () => ({ data: current, revision }),
      write: async (next, expected) => {
        assert.equal(expected, revision);
        writes++;
        current = next;
        revision++;
        throw new Error("Connection lost after commit");
      },
    },
    recording,
    () => now,
    async () => {},
  );
  assert.equal(result.status, "duplicate");
  assert.equal(writes, 1);
  assert.equal(current.meetings.length, 1);
});
test("revision conflicts retry without overwriting concurrent changes", async () => {
  let current = emptyWorkspace(),
    revision = 1,
    writes = 0;
  const result = await syncPlaud(
    {
      read: async () => ({ data: current, revision }),
      write: async (next, expected) => {
        writes++;
        if (writes === 1) {
          current.metadata = { dataset: "live", sourceName: "Concurrent edit" };
          revision++;
          return false;
        }
        assert.equal(expected, revision);
        current = next;
        revision++;
        return true;
      },
    },
    recording,
    () => now,
    async () => {},
  );
  assert.equal(result.attempts, 2);
  assert.equal(current.metadata?.sourceName, "Concurrent edit");
});
test("failed sync records sanitized failure without moving success time", async () => {
  let current = emptyWorkspace(),
    writes = 0;
  await assert.rejects(() =>
    syncPlaud(
      {
        read: async () => ({ data: current, revision: 1 }),
        write: async (next) => {
          if (++writes < 4) throw new Error("secret provider error");
          current = next;
          return true;
        },
      },
      recording,
      () => now,
      async () => {},
    ),
  );
  assert.equal(current.plaudSync?.status, "failed");
  assert.equal(current.plaudSync?.lastSuccessAt, undefined);
  assert.equal(JSON.stringify(current).includes("secret provider"), false);
});
