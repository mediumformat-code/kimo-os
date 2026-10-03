import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sourceMoney,
  commercialTotals,
  overdue,
  taskStatus,
  visibleTasks,
} from "../src/services/business-views";
import { emptyWorkspace } from "../src/services/import-workspace";
test("financial values retain zeros, negatives and missing/error distinctions", () => {
  assert.equal(sourceMoney(""), undefined);
  assert.equal(sourceMoney("#REF!"), undefined);
  assert.equal(sourceMoney("IDR2,266,001,930"), 2266001930);
  assert.equal(sourceMoney("0"), 0);
  assert.equal(sourceMoney("-IDR2,000"), -2000);
  assert.equal(sourceMoney("(1,000.50)"), -1000.5);
  assert.equal(sourceMoney("Rp 1.000.000,50"), 1000000.5);
  assert.equal(sourceMoney("1,2,3"), undefined);
});
test("margin uses matching known pairs rather than sum of row margins", () => {
  const records = [
    {
      id: "a",
      sheet: "s",
      row: 1,
      kind: "commercial" as const,
      fields: { "1. Expected Revenue": "100", "2. Profit": "20" },
    },
    {
      id: "b",
      sheet: "s",
      row: 2,
      kind: "commercial" as const,
      fields: { "1. Expected Revenue": "900", "2. Profit": "90" },
    },
    {
      id: "c",
      sheet: "s",
      row: 3,
      kind: "commercial" as const,
      fields: { "1. Expected Revenue": "#REF!", "2. Profit": "30" },
    },
  ];
  const t = commercialTotals(records);
  assert.equal(t.revenue, 1000);
  assert.equal(t.profit, 140);
  assert.equal(t.revenueMissing, 1);
  assert.equal(t.margin, 0.11);
  assert.equal(t.marginRows, 2);
  assert.equal(commercialTotals([]).margin, undefined);
});
test("task views respect company scope, OS completion and current overdue date", () => {
  const d = emptyWorkspace();
  d.projects = [
    {
      id: "p",
      name: "Brand",
      company: "originals",
      owner: "PIC",
      status: "Active",
      priority: 50,
      deadline: "",
      health: "Watch",
      latestUpdate: "",
      nextAction: "",
      blockers: [],
      people: [],
      meetings: [],
      documents: [],
    },
  ];
  d.actions = [
    {
      id: "a",
      project: "p",
      description: "Task",
      owner: "PIC",
      dueDate: "2026-10-02",
      priority: 50,
      status: "Open",
      horizon: "Later",
      sourceStatus: "On Hold",
    },
  ];
  assert.equal(overdue(d.actions[0], "2026-10-03"), true);
  assert.equal(overdue(d.actions[0], "2026-10-02"), false);
  assert.equal(visibleTasks(d, "studio").length, 0);
  assert.equal(taskStatus(d.actions[0]), "On Hold");
  d.actions[0].status = "Done";
  assert.equal(taskStatus(d.actions[0]), "Done");
  assert.equal(overdue(d.actions[0], "2026-10-03"), false);
});
