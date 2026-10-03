import { test } from "node:test";
import assert from "node:assert/strict";
import { mockWorkspace } from "../src/data/mock";
import { processInbox, topPriorities } from "../src/services/workspace";
test("priorities exclude completed work and respect company scope", () => {
  const data = structuredClone(mockWorkspace);
  data.actions[0].status = "Done";
  assert.equal(topPriorities(data)[0].id, "a2");
  assert.ok(
    topPriorities(data, "studio").every(
      (a) =>
        data.projects.find((p) => p.id === a.project)?.company === "studio",
    ),
  );
});
test("inbox conversions create one linked action and preserve source data", () => {
  const before = structuredClone(mockWorkspace);
  const next = processInbox(before, "i1", "Delegate", "Iyas");
  assert.equal(next.actions.find((a) => a.id === "inbox-i1")?.owner, "Iyas");
  assert.equal(before.inbox[0].status, "Review");
  assert.equal(
    processInbox(next, "i1", "Action").actions.filter(
      (a) => a.id === "inbox-i1",
    ).length,
    1,
  );
});
test("decision conversion retains context and linked project", () => {
  const next = processInbox(mockWorkspace, "i2", "Decision");
  const d = next.decisions.find((d) => d.id === "inbox-i2");
  assert.equal(d?.project, "finance");
  assert.equal(d?.context, mockWorkspace.inbox[1].description);
  assert.equal(d?.status, "Needs Kimo");
});
