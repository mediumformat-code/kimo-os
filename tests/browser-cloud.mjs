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
const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync("src/app/globals.css", "utf8")} ${fs.readFileSync("src/app/executive.css", "utf8")}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`;
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
let otpBody;
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
        json: { configured: false, connected: false },
      });
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
      otpBody = route.request().postDataJSON();
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
  const login = await newPage();
  await login.getByLabel("Email address").fill("kimo@example.com");
  await login.getByRole("button", { name: "Email me a sign-in link" }).click();
  await login.getByRole("heading", { name: "Check your email." }).waitFor();
  assert.equal(otpBody.create_user, false);
  await login.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await login.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await login.screenshot({ path: "/tmp/kimo-login.png" });
  const one = await newPage(true);
  const two = await newPage(true);
  await one.getByText("Your top priorities").waitFor();
  await two.getByText("Your top priorities").waitFor();
  await one.setViewportSize({ width: 1600, height: 1100 });
  await one.screenshot({
    path: "/tmp/kimo-executive-desktop.png",
    fullPage: true,
  });
  await one.getByText("Workspace tools", { exact: true }).click();
  await one.getByRole("button", { name: "Sources", exact: true }).click();
  const capture = one.locator(".capture-panel");
  await capture.getByLabel("Meeting / project title").fill("Plaud review test");
  await capture.getByLabel("Owner", { exact: true }).fill("Kimo");
  await capture
    .getByLabel("Transcript / source text")
    .fill("Confirmed transcript from Plaud.");
  await capture
    .getByLabel("Reviewed next actions — one per line")
    .fill("Review partner proposal");
  await capture
    .getByRole("button", { name: "Review source", exact: true })
    .click();
  assert.match(
    await capture.locator(".capture-preview").innerText(),
    /Confirmed transcript/,
  );
  // Preview never writes the workspace.
  assert.equal(
    row?.data.meetings.some((m) => m.title === "Plaud review test") ?? false,
    false,
  );
  await one.getByRole("button", { name: "Today", exact: true }).click();
  await one.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await one.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await one.waitForTimeout(350);
  await one.screenshot({
    path: "/tmp/kimo-executive-mobile.png",
    fullPage: true,
  });
  await one.setViewportSize({ width: 1600, height: 1100 });

  await one
    .getByRole("button", {
      name: "Approve Medium Format Q4 budget",
      exact: false,
    })
    .click();
  await one
    .getByRole("button", { name: "Approve phased budget", exact: true })
    .click();
  await one
    .getByRole("status")
    .filter({ hasText: "Decision recorded" })
    .waitFor();
  await two
    .getByRole("button", {
      name: "Approve Medium Format Q4 budget",
      exact: false,
    })
    .click();
  await two
    .getByRole("button", { name: "Request revision", exact: true })
    .click();
  await two.getByText("Changes were not saved.").waitFor();
  assert.equal(row.data.decisions[0].finalDecision, "Approve phased budget");
  await two
    .getByRole("button", { name: "Reload latest workspace", exact: true })
    .click();
  await two.getByText("Your top priorities").waitFor();
  assert.equal(
    await two
      .getByRole("button", {
        name: "Approve Medium Format Q4 budget",
        exact: false,
      })
      .count(),
    0,
  );
  offline = true;
  await one
    .getByRole("button", {
      name: "Complete Unblock the The Others venue lease",
      exact: true,
    })
    .click();
  await one.getByText("Changes were not saved.").waitFor();
  assert.equal(row.data.actions[0].status, "Open");
  offline = false;
  await one.getByRole("button", { name: "Settings", exact: true }).click();
  await one.getByRole("button", { name: "Sign out on this device" }).click();
  await one.getByLabel("Email address").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Cloud browser checks passed with mocked Supabase: invited-only email link, session restoration, cross-device persistence, conflict protection, failed-save integrity, mobile login, sign out.",
  );
} finally {
  await browser.close();
}
