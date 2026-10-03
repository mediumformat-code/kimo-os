import test from "node:test";
import assert from "node:assert/strict";
import { mockWorkspace } from "../src/data/mock";
import {
  executiveWorkspace,
  scopeExecutive,
} from "../src/presentation/hierarchy";
import { performance } from "../src/presentation/performance";
import { appendCapture, captureText } from "../src/presentation/capture";
import { isWorkspace } from "../src/services/validation";
test("executive projection has two companies and preserves original workspace", () => {
  const before = JSON.stringify(mockWorkspace);
  const view = executiveWorkspace(mockWorkspace);
  assert.deepEqual(
    view.companies.map((c) => c.id),
    ["studio", "originals"],
  );
  assert.equal(JSON.stringify(mockWorkspace), before);
  assert.ok(!view.projects.some((p) => /by\.?u|a mild/i.test(p.name)));
  assert.ok(
    scopeExecutive(view, "originals", "retail").projects.every((p) =>
      /medium|retail/i.test(p.name),
    ),
  );
});
test("live revenue stays unreported without verified financial records", () => {
  assert.equal(performance([], "Year").total, undefined);
});
test("GPT import follows active conversation branch only", () => {
  const input = JSON.stringify([
    {
      title: "Project brief",
      current_node: "b",
      mapping: {
        a: {
          parent: null,
          message: { author: { role: "user" }, content: { parts: ["Brief"] } },
        },
        b: {
          parent: "a",
          message: {
            author: { role: "assistant" },
            content: { parts: ["Final"] },
          },
        },
        c: {
          parent: "a",
          message: {
            author: { role: "assistant" },
            content: { parts: ["Discarded"] },
          },
        },
      },
    },
  ]);
  const result = captureText(input);
  assert.match(result, /Final/);
  assert.doesNotMatch(result, /Discarded/);
});
test("reviewed Plaud capture adds source and actions without replacing Sheets state", () => {
  let i = 0;
  const before = JSON.stringify(mockWorkspace);
  const next = appendCapture(
    mockWorkspace,
    {
      kind: "Plaud",
      title: "Weekly meeting",
      owner: "Kimo",
      text: "Confirmed source transcript",
      company: "originals",
      projectId: mockWorkspace.projects[0].id,
      date: "2026-10-03T12:00:00+07:00",
      actions: ["Review proposal"],
    },
    () => `capture-${++i}`,
  );
  assert.equal(JSON.stringify(mockWorkspace), before);
  assert.equal(next.projects.length, mockWorkspace.projects.length);
  assert.equal(next.meetings.at(-1)?.summary, "Confirmed source transcript");
  assert.equal(next.actions.at(-1)?.description, "Review proposal");
  assert.equal(next.businessSync, mockWorkspace.businessSync);
  assert.ok(isWorkspace(next));
  assert.throws(
    () =>
      appendCapture(next, {
        kind: "Plaud",
        title: "Weekly meeting",
        owner: "Kimo",
        text: "Confirmed source transcript",
        company: "originals",
        projectId: mockWorkspace.projects[0].id,
        date: "2026-10-03T12:00:00+07:00",
        actions: [],
      }),
    /sudah diimpor/,
  );
});

import { removeDemo } from "../src/presentation/remove-demo";
test("seed cleanup removes simulated records while retaining imported projects and sync metadata", () => {
  const raw = structuredClone(mockWorkspace);
  const real = {
    ...raw.projects[0],
    id: "sheet-row-real",
    name: "Actual source project",
  };
  raw.projects.push(real);
  raw.metadata = { dataset: "live" };
  const cleaned = removeDemo(raw);
  assert.deepEqual(
    cleaned.projects.map((p) => p.id),
    ["sheet-row-real"],
  );
  assert.equal(cleaned.actions.length, 0);
  assert.equal(cleaned.meetings.length, 0);
  assert.equal(cleaned.people.length, 0);
  assert.equal(raw.projects.length, mockWorkspace.projects.length + 1);
  assert.deepEqual(removeDemo(cleaned), cleaned);
});
