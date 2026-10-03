import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3000");
await page.getByText("Your top priorities").waitFor();
await page.screenshot({ path: "/tmp/kimo-desktop.png", fullPage: true });
await page
  .getByRole("button", {
    name: "Approve Medium Format Q4 budget",
    exact: false,
  })
  .first()
  .click();
await page
  .getByRole("button", { name: "Approve phased budget", exact: true })
  .click();
await page.reload();
await page.getByText("Your top priorities").waitFor();
assert.equal(
  await page
    .getByRole("button", {
      name: "Approve Medium Format Q4 budget",
      exact: false,
    })
    .count(),
  0,
);
await page.locator("nav").getByRole("button", { name: "Decisions" }).click();
await page.getByRole("button", { name: "Decided", exact: false }).click();
await page.getByText("Approve phased budget", { exact: true }).waitFor();
await page.locator("nav").getByRole("button", { name: "Inbox" }).click();
await page.getByRole("button", { name: "Convert to action" }).first().click();
await page.locator("nav").getByRole("button", { name: "Priorities" }).click();
await page
  .getByText("COMMONS lease terms need a decision", { exact: true })
  .waitFor();
await page.locator("nav").getByRole("button", { name: "People" }).click();
await page.getByRole("button", { name: "Delegate an action" }).first().click();
await page
  .getByPlaceholder("What needs to move forward?")
  .fill("Confirm venue negotiation boundaries");
await page
  .getByRole("button", { name: "Delegate action", exact: true })
  .click();
await page
  .getByText("Confirm venue negotiation boundaries", { exact: true })
  .waitFor();
await page.locator("nav").getByRole("button", { name: "Search" }).click();
await page
  .getByRole("button", { name: "Show all overdue commitments" })
  .click();
await page
  .getByText("Share the revised COMMONS lease comparison", { exact: true })
  .waitFor();
for (const name of [
  "Today",
  "Priorities",
  "Decisions",
  "Projects",
  "People",
  "Meetings",
  "Inbox",
  "Search",
]) {
  await page.locator("nav").getByRole("button", { name, exact: false }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    `desktop overflow ${name}`,
  );
}
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Open navigation" }).click();
await page.locator("nav").getByRole("button", { name: "Today" }).click();
await page
  .locator(".sidebar")
  .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
await page.screenshot({ path: "/tmp/kimo-mobile.png", fullPage: true });
for (const name of [
  "Today",
  "Priorities",
  "Decisions",
  "Projects",
  "People",
  "Meetings",
  "Inbox",
  "Search",
]) {
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator("nav").getByRole("button", { name, exact: false }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    `mobile overflow ${name}`,
  );
}
assert.deepEqual(errors, []);
console.log(
  "Browser checks passed: decisions persist, inbox conversion, delegation, search, all views at desktop/mobile, no page errors.",
);
await browser.close();
