import { chromium } from "@playwright/test";
import { build } from "esbuild";
import fs from "node:fs";
import assert from "node:assert/strict";
const built = await build({
  stdin: {
    contents:
      "import {createRoot} from 'react-dom/client';import {WorkspaceAccess} from './src/components/workspace-access';createRoot(document.getElementById('root')).render(<WorkspaceAccess/>);",
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '"https://kimo-test.supabase.co"',
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": '"test-public-key"',
  },
});
const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync("src/app/globals.css", "utf8")}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`;
const id = "11111111-1111-4111-8111-111111111111";
const user = {
  id,
  email: "kimo@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const token = [
  "eyJhbGciOiJIUzI1NiJ9",
  Buffer.from(
    JSON.stringify({
      sub: id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: "authenticated",
      aud: "authenticated",
    }),
  ).toString("base64url"),
  "signature",
].join(".");
const session = {
  access_token: token,
  refresh_token: "test-refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: "bearer",
  user,
};
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
let row = null;
let refined = false;
const actions = [];
let offline = false;
let errors = [];
async function newPage(auth = false) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
  });
  if (auth)
    await context.addInitScript(
      (s) => localStorage.setItem("sb-kimo-test-auth-token", JSON.stringify(s)),
      session,
    );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/google/status") {
      await route.fulfill({
        status: 200,
        json: {
          configured: true,
          connected: true,
          email: "kimo@example.com",
          scopes: [],
          snapshot: {
            events: [],
            mail: [],
            files: [],
            warnings: [],
            sourceUpdatedAt: {},
            updatedAt: new Date().toISOString(),
          },
        },
      });
      return;
    }
    if (url.pathname === "/api/gpt/proposals") {
      await route.fulfill({ json: { proposals: [] } });
      return;
    }
    if (url.pathname === "/api/google/business") {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: {
            hash: refined ? "refined" : "initial",
            inputHash: "input-fingerprint",
            canEdit: true,
            patchCount: refined ? 0 : 1,
            changes: refined ? [] : ["Repair total"],
            warnings: [],
            examples: refined
              ? []
              : [
                  {
                    tab: "Test",
                    cell: "A1",
                    before: "=SUM(A3:A4)",
                    after: "=SUM(A2:A4)",
                  },
                ],
            counts: { projects: 1, tasks: 1, leads: 0, commercial: 1, tabs: 3 },
            backups: refined
              ? [
                  {
                    source: "test",
                    url: "https://docs.google.com/spreadsheets/d/test/edit",
                  },
                ]
              : [],
          },
        });
      } else {
        const body = route.request().postDataJSON();
        actions.push(body.action);
        if (body.action === "refine") {
          assert.equal(body.hash, "initial");
          assert.equal(body.inputHash, "input-fingerprint");
          refined = true;
        }
        if (body.action === "enable") {
          assert.equal(body.hash, "refined");
          assert.equal(body.expectedRevision, row?.revision ?? 0);
          row.data.businessSync = {
            enabled: true,
            lastSyncedAt: new Date().toISOString(),
            sourceHash: "refined",
            projectIds: [],
            actionIds: [],
            personIds: [],
            recordIds: [],
            sheetIds: [],
            warnings: [],
          };
          row.revision++;
        }
        await route.fulfill({
          json: { changed: body.action === "enable", refined: true },
        });
      }
      return;
    }
    if (url.hostname === "localhost") {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: html,
      });
      return;
    }
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (url.pathname === "/auth/v1/otp") {
      await route.fulfill({ status: 200, headers, json: {} });
      return;
    }
    if (url.pathname === "/auth/v1/logout") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (url.pathname === "/rest/v1/workspaces") {
      await route.fulfill({ status: 200, headers, json: row ? [row] : [] });
      return;
    }
    if (url.pathname === "/rest/v1/rpc/save_workspace") {
      const body = route.request().postDataJSON();
      if (offline) {
        await route.fulfill({
          status: 503,
          headers,
          json: { code: "503", message: "Offline" },
        });
        return;
      }
      if (body.expected_revision !== (row?.revision ?? 0)) {
        await route.fulfill({
          status: 409,
          headers,
          json: { code: "40001", message: "Conflict" },
        });
        return;
      }
      row = { data: body.workspace_data, revision: body.expected_revision + 1 };
      await route.fulfill({ status: 200, headers, json: row.revision });
      return;
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
  await page.goto("http://localhost:3199");
  return page;
}
try {
  const page = await newPage(true);
  await page.getByText("Your top priorities").waitFor();
  // Persist initial workspace as if previously saved by the owner.
  await page
    .getByRole("button", {
      name: "Complete Unblock the COMMONS venue lease",
      exact: true,
    })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Priority updated" })
    .waitFor();
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await page.getByRole("button", { name: "Read & review live sheets" }).click();
  const refine = page.getByRole("button", {
    name: "Back up & refine source sheets",
  });
  assert.equal(await refine.isDisabled(), true);
  await page.getByText("Preview cell changes (up to 30)").click();
  await page.getByText("Test · A1", { exact: true }).waitFor();
  await page.getByRole("checkbox").first().check();
  await refine.click();
  await page
    .getByRole("button", { name: "Download OS backup before activation" })
    .waitFor();
  const activate = page.getByRole("button", {
    name: "Activate live Sheets → OS sync",
  });
  assert.equal(await activate.isDisabled(), true);
  await page.getByRole("checkbox").first().check();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download OS backup before activation" })
    .click();
  await download;
  await activate.click();
  await page.getByRole("button", { name: "Sync sheets now" }).waitFor();
  await page.getByRole("button", { name: "Sync sheets now" }).click();
  assert.ok(actions.includes("sync"));
  assert.deepEqual(actions.slice(0, 2), ["refine", "enable"]);
  assert.equal(row.data.businessSync.enabled, true);
  await page.getByRole("button", { name: "Pause live sync" }).click();
  await page.getByText("Live sync dihentikan.").waitFor();
  assert.equal(row.data.businessSync.enabled, false);
  assert.deepEqual(errors, []);
  console.log(
    "Live sheets browser checks passed: cell preview, review gates, refine, backup, activation, sync, pause.",
  );
} finally {
  await browser.close();
}
