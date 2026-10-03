import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/gpt/schema/route";
test("GPT action schema exposes an object schemas section and explicit object properties", async () => {
  const response = await GET(
    new Request("https://kimo-os-rbcy.vercel.app/api/gpt/schema"),
  );
  const schema = await response.json();
  assert.equal(schema.openapi, "3.1.0");
  assert.deepEqual(schema.components.schemas, {});
  assert.equal(schema.servers[0].url, "https://kimo-os-rbcy.vercel.app");
  const read =
    schema.paths["/api/gpt/workspace"].get.responses["200"].content[
      "application/json"
    ].schema;
  const write =
    schema.paths["/api/gpt/proposals"].post.requestBody.content[
      "application/json"
    ].schema;
  assert.deepEqual(read.properties.data.properties, {});
  assert.deepEqual(write.properties.workspace.properties, {});
  assert.deepEqual(write.required, ["title", "workspace"]);
  assert.equal(schema.components.securitySchemes.bridgeKey.scheme, "bearer");
});
