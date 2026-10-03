import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCloudConfig,
  CloudConfigurationError,
  startupErrorMessage,
} from "../src/lib/cloud-config";
test("copied config tolerates whitespace and surrounding quotes", () => {
  assert.deepEqual(
    validateCloudConfig(
      '  "https://example.supabase.co/"\n',
      " 'sb_publishable_example' ",
    ),
    { url: "https://example.supabase.co", key: "sb_publishable_example" },
  );
});
test("rejects dashboard URLs, app URLs and secret keys with specific safe messages", () => {
  for (const [url, key] of [
    ["https://kimo-os-rbcy.vercel.app", "sb_publishable_x"],
    ["https://supabase.com/dashboard/project/x", "sb_publishable_x"],
    ["https://example.supabase.co", "sb_secret_test"],
  ])
    assert.throws(() => validateCloudConfig(url, key), CloudConfigurationError);
});
test("distinguishes browser storage errors from configuration errors", () => {
  assert.match(
    startupErrorMessage(new DOMException("Blocked", "SecurityError")),
    /penyimpanan/,
  );
  assert.equal(
    startupErrorMessage(new CloudConfigurationError("Missing URL")),
    "Missing URL",
  );
});
