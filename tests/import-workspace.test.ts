import { test } from "node:test";
import assert from "node:assert/strict";
import {
  prepareWorkspaceImport,
  emptyWorkspace,
  mergeProjectSources,
} from "../src/services/import-workspace";
import { mockWorkspace } from "../src/data/mock";
import { isWorkspace } from "../src/services/validation";
test("real project imports contain no sample commitments or projects", () => {
  const data = prepareWorkspaceImport(
    '```json\n{"projects":[{"name":"Real venture","company":"DDO","owner":"Iyas","nextAction":"Confirm plan"}]}\n```',
    "GPT export",
  );
  assert.equal(data.projects.length, 1);
  assert.equal(data.projects[0].company, "originals");
  assert.equal(data.people[0].name, "Iyas");
  assert.equal(data.commitments.length, 0);
  assert.equal(data.metadata?.dataset, "live");
  assert.equal(isWorkspace(data), true);
  assert.equal(mockWorkspace.projects.length, 11);
});
test("owner omissions and duplicate project IDs require correction", () => {
  assert.throws(
    () =>
      prepareWorkspaceImport(
        '{"projects":[{"name":"Project","company":"DDS"}]}',
        "source",
      ),
    /owner/,
  );
  assert.throws(
    () =>
      prepareWorkspaceImport(
        '{"projects":[{"id":"p","name":"One","company":"DDS","owner":"A"},{"id":"p","name":"Two","company":"DDS","owner":"A"}]}',
        "source",
      ),
    /duplikat/,
  );
});
test("empty live workspace keeps company structure and remains valid", () => {
  assert.equal(isWorkspace(emptyWorkspace()), true);
  assert.equal(emptyWorkspace().projects.length, 0);
  assert.equal(emptyWorkspace().companies.length, 3);
});
test("source merge preserves DDS and DDO and blocks conflicting owners", () => {
  const dds = prepareWorkspaceImport(
    '{"projects":[{"name":"Campaign","company":"DDS","owner":"Nadia"}]}',
    "DDS",
  );
  const ddo = prepareWorkspaceImport(
    '{"projects":[{"name":"Venue","company":"DDO","owner":"Iyas"}]}',
    "DDO",
  );
  const merged = mergeProjectSources([dds, ddo]);
  assert.equal(merged.projects.length, 2);
  const duplicate = structuredClone(dds);
  duplicate.projects[0].owner = "Raka";
  assert.throws(() => mergeProjectSources([dds, duplicate]), /konflik/);
});
