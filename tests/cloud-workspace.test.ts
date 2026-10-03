import { test } from "node:test";
import assert from "node:assert/strict";
import { mockWorkspace } from "../src/data/mock";
import {
  createVersionedWorkspaceService,
  WorkspaceConflictError,
  WorkspaceStore,
} from "../src/services/cloud-workspace";
import { isWorkspace } from "../src/services/validation";
function memoryStore() {
  let row: { data: unknown; revision: number } | null = null;
  const store: WorkspaceStore = {
    async read() {
      return structuredClone(row);
    },
    async write(data, expected) {
      if (expected !== (row?.revision ?? 0)) throw new WorkspaceConflictError();
      row = { data: structuredClone(data), revision: expected + 1 };
      return row.revision;
    },
  };
  return store;
}
test("cloud saves persist across service instances and isolate mutable snapshots", async () => {
  const store = memoryStore();
  const one = createVersionedWorkspaceService(store);
  const data = await one.load();
  data.decisions[0].status = "Decided";
  data.decisions[0].finalDecision = "Approve phased budget";
  await one.save(data);
  const two = createVersionedWorkspaceService(store);
  assert.equal(
    (await two.load()).decisions[0].finalDecision,
    "Approve phased budget",
  );
  assert.equal(mockWorkspace.decisions[0].status, "Needs Kimo");
});
test("stale devices cannot overwrite the newer workspace", async () => {
  const store = memoryStore();
  const one = createVersionedWorkspaceService(store);
  const two = createVersionedWorkspaceService(store);
  const a = await one.load();
  const b = await two.load();
  await one.save(a);
  await assert.rejects(two.save(b), WorkspaceConflictError);
  await two.load();
  await two.save(b);
});
test("failed saves leave revision intact so a retry can succeed", async () => {
  const store = memoryStore();
  const write = store.write;
  let offline = true;
  store.write = async (...args) => {
    if (offline) throw new Error("Offline");
    return write(...args);
  };
  const service = createVersionedWorkspaceService(store);
  const data = await service.load();
  await assert.rejects(service.save(data), /Offline/);
  offline = false;
  await service.save(data);
  assert.equal((await store.read())?.revision, 1);
});
test("malformed snapshots and dangling project references are rejected", () => {
  assert.equal(isWorkspace(mockWorkspace), true);
  const bad = structuredClone(mockWorkspace);
  bad.projects[0].blockers = null as unknown as string[];
  assert.equal(isWorkspace(bad), false);
  const dangling = structuredClone(mockWorkspace);
  dangling.actions[0].project = "missing";
  assert.equal(isWorkspace(dangling), false);
  assert.equal(isWorkspace(null), false);
});
test("remote malformed data never renders as a workspace", async () => {
  const service = createVersionedWorkspaceService({
    async read() {
      return { data: {}, revision: 1 };
    },
    async write() {
      return 2;
    },
  });
  await assert.rejects(service.load(), /incompatible/);
});
