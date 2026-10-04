import test from "node:test";
import assert from "node:assert/strict";
import { mockWorkspace } from "../src/data/mock";
import { readWorkspace } from "../src/presentation/gpt-read";
test("GPT overview excludes raw archives and bounded list previews retain continuation", () => {
  const data = structuredClone(mockWorkspace);
  data.meetings[0].summary = "長".repeat(100000);
  const overview = readWorkspace(data, new URLSearchParams());
  assert.ok(JSON.stringify(overview).length < 10000);
  const page = readWorkspace(
    data,
    new URLSearchParams("section=meetings&limit=1"),
  );
  assert.ok(JSON.stringify(page).length < 18000);
  assert.equal(page.nextOffset, 1);
});
test("full Plaud source can be reconstructed from bounded chunks without loss", () => {
  const data = structuredClone(mockWorkspace);
  data.meetings[0].summary = "Plaud 📝 context ".repeat(4000);
  let offset = 0;
  let text = "";
  for (;;) {
    const page = readWorkspace(
      data,
      new URLSearchParams({
        section: "meetings",
        id: data.meetings[0].id,
        offset: String(offset),
      }),
    );
    text += page.serializedRecordChunk;
    assert.ok(JSON.stringify(page).length < 25000);
    if (page.nextOffset === null) break;
    offset = page.nextOffset as number;
  }
  assert.deepEqual(JSON.parse(text), data.meetings[0]);
  assert.throws(() =>
    readWorkspace(data, new URLSearchParams("section=credentials")),
  );
});
