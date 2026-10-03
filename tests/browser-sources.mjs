import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.KIMO_TEST_URL || "http://localhost:3002");
await page.getByRole("button", { name: "Sources", exact: true }).click();
await page
  .getByText("Paste project JSON", { exact: true })
  .locator("textarea")
  .fill(
    JSON.stringify({
      projects: [
        {
          name: "Smoke project",
          company: "DDO",
          owner: "Test owner",
          latestUpdate: "Imported test record",
        },
      ],
    }),
  );
await page.getByRole("button", { name: "Review import", exact: true }).click();
assert.equal(
  await page
    .getByRole("button", { name: "Confirm replacement", exact: true })
    .isDisabled(),
  true,
);
const downloaded = page.waitForEvent("download");
await page
  .getByRole("button", { name: "Download current backup first", exact: true })
  .click();
await downloaded;
await page
  .getByRole("button", { name: "Confirm replacement", exact: true })
  .click();
await page.reload();
await page.getByRole("button", { name: "Projects", exact: true }).click();
await page.getByText("Smoke project", { exact: true }).first().waitFor();
await page.getByRole("button", { name: "Today", exact: true }).click();
assert.equal(
  await page.getByText("Medium Format Q4 budget", { exact: true }).count(),
  0,
);
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Sources", exact: true }).click();
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
assert.deepEqual(errors, []);
await browser.close();
process.stdout.write(
  "Source replacement backup gating, persistence, live Today and mobile checks passed.\n",
);
