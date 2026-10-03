import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { seal, unseal } from "../src/integrations/google/crypto";
import { documentText, syncGoogle } from "../src/integrations/google/adapters";
import { businessSources } from "../src/integrations/google/sources";
import { POST as connect } from "../src/app/api/google/connect/route";
import { GET as status } from "../src/app/api/google/status/route";
import { POST as sync } from "../src/app/api/google/sync/route";
import { POST as key } from "../src/app/api/gpt/key/route";
import { POST as proposal } from "../src/app/api/gpt/proposals/route";
import { POST as chat } from "../src/app/api/ai/chat/route";
test("Google credentials are encrypted with authenticated tamper detection", () => {
  const key = randomBytes(32);
  const value = { refreshToken: "TEST_TOKEN", owner: "owner" };
  const encrypted = seal(value, key);
  assert.ok(!encrypted.includes("TEST_TOKEN"));
  assert.deepEqual(unseal(encrypted, key), value);
  const parts = encrypted.split(".");
  const ciphertext = Buffer.from(parts[2], "base64url");
  ciphertext[0] ^= 1;
  parts[2] = ciphertext.toString("base64url");
  assert.throws(() => unseal(parts.join("."), key));
  assert.throws(() => unseal(encrypted, randomBytes(32)));
});
test("Google Docs extraction supports nested table/tab text as plain data", () => {
  assert.equal(
    documentText({
      tabs: [
        {
          documentTab: {
            body: {
              content: [
                {
                  paragraph: {
                    elements: [{ textRun: { content: "Hello\n" } }],
                  },
                },
                {
                  table: {
                    tableRows: [
                      {
                        tableCells: [
                          {
                            content: [
                              {
                                paragraph: {
                                  elements: [
                                    { textRun: { content: "Table text" } },
                                  ],
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      ],
    }),
    "Hello\nTable text",
  );
});
test("every user-provided spreadsheet records its exact tab ID", () => {
  assert.deepEqual(
    businessSources.map((s) => s.gid),
    ["831862500", "1575253720", "1117419069"],
  );
  assert.equal(businessSources.filter((s) => s.company === "DDS").length, 2);
});
test("integration and AI routes reject unsigned callers without network access", async () => {
  for (const route of [connect, sync, key, proposal, chat]) {
    const response = await route(
      new Request("https://example.com/api", { method: "POST" }),
    );
    assert.equal(response.status, 401);
  }
  assert.equal(
    (await status(new Request("https://example.com/api"))).status,
    401,
  );
});
test("partial Google sync preserves stale sources and labels them explicitly", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("calendarList")) return Response.json({ items: [] });
    if (url.includes("gmail"))
      return Response.json({ error: "denied" }, { status: 403 });
    if (url.includes("drive")) return Response.json({ files: [] });
    throw new Error("Unexpected request");
  };
  try {
    const previous = {
      events: [],
      mail: [
        {
          id: "m",
          subject: "Old email",
          from: "Sender",
          snippet: "",
          date: "2026-10-01",
          unread: true,
          url: "https://mail.google.com",
        },
      ],
      files: [],
      updatedAt: "old",
      sourceUpdatedAt: { mail: "old" },
      warnings: [],
    };
    const next = await syncGoogle("TEST_TOKEN", previous);
    assert.equal(next.mail[0].id, "m");
    assert.equal(next.sourceUpdatedAt.mail, "old");
    assert.ok(next.warnings[0].includes("Gmail"));
  } finally {
    globalThis.fetch = original;
  }
});
