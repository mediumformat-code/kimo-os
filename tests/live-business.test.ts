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
