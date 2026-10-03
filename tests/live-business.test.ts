import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareBusinessSheets } from "../src/services/business-import";
import {
  mergeLiveBusiness,
  normalizeSourceDate,
} from "../src/services/live-business";
import { emptyWorkspace } from "../src/services/import-workspace";
import {
  refinementPlan,
  sourceInputHash,
  sourceHash,
  googlePost,
  applyRefinements,
  type LiveSheet,
} from "../src/integrations/google/business";
import { GET, POST } from "../src/app/api/google/business/route";
const task = (rows: string[][]): LiveSheet => ({
  id: "s",
  file: "DDO dashboard",
  title: "DDO TASK",
  live: true,
  spreadsheetId: "book",
  sheetId: 1,
  columnCount: 10,
  rowCount: 100,
  formulas: rows,
  rows,
});
const header = [
  "ID",
  "Workspace",
  "Task Title",
  "Beliau",
  "Status",
  "Priority",
  "KIMO Row Key",
];
const a = ["same", "Brand", "One", "PIC", "In Progress", "High", "key-a"];
const b = ["same", "Brand", "Two", "PIC", "On Hold", "High", "key-b"];
test("live identities survive row reordering and duplicate native IDs", () => {
  const x = prepareBusinessSheets([task([header, a, b])]);
  const y = prepareBusinessSheets([task([header, b, a])]);
  assert.deepEqual(
    x.actions.map((a) => a.id).sort(),
    y.actions.map((a) => a.id).sort(),
  );
  const first = mergeLiveBusiness(emptyWorkspace(), x, "1", []);
  first.projects[0].nextAction = "Manual executive follow-up";
  const second = mergeLiveBusiness(first, y, "2", []);
  assert.equal(second.projects[0].nextAction, "Manual executive follow-up");
  assert.equal(second.actions.length, 2);
  assert.equal(second.projects.length, 1);
});
test("sync preserves manual decisions, actions and removed project history", () => {
  const x = prepareBusinessSheets([task([header, a])]);
  const first = mergeLiveBusiness(emptyWorkspace(), x, "1", []);
  const p = first.projects[0].id;
  first.actions.push({
    ...first.actions[0],
    id: "manual",
    sourceRef: undefined,
  });
  const next = mergeLiveBusiness(first, emptyWorkspace(), "2", []);
  assert.equal(next.actions.length, 1);
  assert.equal(next.actions[0].id, "manual");
  assert.equal(next.projects[0].id, p);
  assert.match(next.projects[0].status!, /Archived/);
});
test("refinement creates identities without altering native duplicate IDs and is repeatable", () => {
  const s = task([header.slice(0, -1), a.slice(0, -1), b.slice(0, -1)]);
  const plan = refinementPlan([s]);
  assert.equal(plan.patches.length, 3);
  for (const p of plan.patches) {
    assert.equal(p.formula, false);
    s.rows[p.row - 1][p.column - 1] = p.value;
  }
  assert.equal(refinementPlan([s]).patches.length, 0);
  assert.equal(s.rows[1][0], "same");
  assert.throws(
    () => refinementPlan([task([header, a, [...b.slice(0, -1), "key-a"]])]),
    /duplikat/,
  );
});
test("source writes never begin when backup metadata fails", async () => {
  const old = global.fetch;
  const calls: string[] = [];
  global.fetch = async (input) => {
    calls.push(String(input));
    return Response.json({ spreadsheetId: "backup" });
  };
  try {
    const s = task([header, a.slice(0, -1)]);
    await assert.rejects(
      () =>
        applyRefinements("test", [s], refinementPlan([s]), async () => {
          throw Error("metadata failure");
        }),
      /metadata failure/,
    );
    assert.equal(
      calls.some((url) => url.includes(":batchUpdate")),
      false,
    );
  } finally {
    global.fetch = old;
  }
});
test("live endpoints reject unsigned callers", async () => {
  for (const call of [GET, POST]) {
    const response = await call(
      new Request("https://example.test/api/google/business"),
    );
    assert.equal(response.status, 401);
  }
});
test("source dates reject invalid calendar dates", () => {
  assert.equal(normalizeSourceDate("22/07/2026"), "2026-07-22");
  assert.equal(normalizeSourceDate("31/02/2026"), "31/02/2026");
});

test("backup edit fingerprint ignores volatile formula results but detects changed inputs", () => {
  const before = task([
    ["NOW", "Status"],
    ["12:00", "Open"],
  ]);
  before.formulas = [
    ["NOW", "Status"],
    ["=NOW()", "Open"],
  ];
  const after = structuredClone(before);
  after.rows[1][0] = "12:01";
  assert.equal(sourceInputHash([before]), sourceInputHash([after]));
  assert.notEqual(sourceHash([before]), sourceHash([after]));
  after.formulas[1][1] = "Done";
  assert.notEqual(sourceInputHash([before]), sourceInputHash([after]));
});
test("Google failures identify operation and redact access credentials", async () => {
  const old = global.fetch;
  global.fetch = async () =>
    Response.json(
      {
        error: {
          message: "The caller does not have permission. TEST_ACCESS_TOKEN",
        },
      },
      { status: 403 },
    );
  try {
    await assert.rejects(
      () =>
        googlePost(
          "https://example.test",
          "TEST_ACCESS_TOKEN",
          {},
          "Menyalin backup Test",
        ),
      (e) => {
        assert.match((e as Error).message, /Menyalin backup Test · Google 403/);
        assert.match((e as Error).message, /does not have permission/);
        assert.ok(!(e as Error).message.includes("TEST_ACCESS_TOKEN"));
        return true;
      },
    );
  } finally {
    global.fetch = old;
  }
});
test("a failed backup copy never reaches source updates", async () => {
  const old = global.fetch;
  const calls: string[] = [];
  global.fetch = async (input) => {
    calls.push(String(input));
    return String(input).includes(":copyTo")
      ? Response.json(
          { error: { message: "Permission denied" } },
          { status: 403 },
        )
      : Response.json({ spreadsheetId: "backup" });
  };
  try {
    const s = task([header, a.slice(0, -1)]);
    await assert.rejects(
      () => applyRefinements("test", [s], refinementPlan([s])),
      /Menyalin backup/,
    );
    assert.ok(!calls.some((c) => c.endsWith(":batchUpdate")));
  } finally {
    global.fetch = old;
  }
});

test("DDO monitoring works without row keys and survives progress edits and row sorting", () => {
  const s = task([header.slice(0, -1), a.slice(0, -1), b.slice(0, -1)]);
  s.readOnly = true;
  assert.equal(refinementPlan([s]).patches.length, 0);
  const first = prepareBusinessSheets([s]);
  const reordered = structuredClone(s);
  reordered.rows = [s.rows[0], [...s.rows[2]], [...s.rows[1]]];
  reordered.rows[2][4] = "Completed";
  const second = prepareBusinessSheets([reordered]);
  assert.deepEqual(
    first.actions.map((a) => a.id).sort(),
    second.actions.map((a) => a.id).sort(),
  );
  assert.equal(
    second.actions.find((a) => a.description === "One")?.status,
    "Done",
  );
  assert.equal(first.actions.length, 2);
});
test("stale refinement plans cannot write a DDO read-only source", async () => {
  const s = task([header.slice(0, -1), a.slice(0, -1)]);
  const oldPlan = refinementPlan([s]);
  s.readOnly = true;
  const old = global.fetch;
  let called = false;
  global.fetch = async () => {
    called = true;
    throw Error("unexpected network");
  };
  try {
    await assert.rejects(
      () => applyRefinements("test", [s], oldPlan),
      /monitoring saja/,
    );
    assert.equal(called, false);
  } finally {
    global.fetch = old;
  }
});
