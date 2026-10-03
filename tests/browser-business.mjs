import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const data = {
  metadata: { dataset: "live" },
  companies: [
    { id: "originals", name: "DDO", description: "DDO" },
    { id: "studio", name: "DDS", description: "DDS" },
  ],
  projects: [
    {
      id: "p",
      name: "Test brand",
      company: "originals",
      owner: "Test PIC",
      status: "Active",
      priority: 50,
      deadline: "",
      health: "Watch",
      latestUpdate: "",
      nextAction: "",
      blockers: [],
      people: [],
      meetings: [],
      documents: [],
    },
  ],
  people: [],
  actions: [
    {
      id: "a",
      description: "Test overdue task",
      owner: "Test PIC",
      dueDate: "2020-01-01",
      project: "p",
      priority: 50,
      status: "Open",
      horizon: "Later",
      sourceStatus: "In Progress",
      sourceRef: "t",
    },
    {
      id: "b",
      description: "Test paused task",
      owner: "Test PIC",
      dueDate: "",
      project: "p",
      priority: 50,
      status: "Open",
      horizon: "Later",
      sourceStatus: "On Hold",
    },
  ],
  decisions: [],
  commitments: [],
  meetings: [],
  risks: [],
  inbox: [],
  sourceSheets: [
    { id: "s", file: "test.xlsx", title: "Commercial", rows: [] },
    { id: "s2", file: "duplicate.xlsx", title: "Commercial", rows: [] },
    { id: "l", file: "test.xlsx", title: "Leads", rows: [] },
  ],
  sourceRecords: [
    {
      id: "t",
      sheet: "s",
      row: 2,
      kind: "task",
      fields: { "1. TDL Notes": "Original task notes" },
    },
    {
      id: "r",
      sheet: "s",
      row: 2,
      kind: "commercial",
      fields: {
        "1. Project Name": "Test opportunity",
        "2. Client": "Test client",
        "3. Account": "Test account",
        "4. Status": "Ongoing",
        "5. Expected Revenue": "1000",
        "6. Profit": "100",
      },
    },
    {
      id: "r2",
      sheet: "s2",
      row: 2,
      kind: "commercial",
      fields: {
        "1. Project Name": "Duplicate source record",
        "2. Expected Revenue": "999999",
        "3. Profit": "5",
      },
    },
    {
      id: "l1",
      sheet: "l",
      row: 2,
      kind: "lead",
      fields: {
        "1. Company": "Test prospect",
        "2. Name": "Test contact",
        "3. Email": "test@example.test",
        "4. Commercial PIC": "Test account",
        "5. Status": "Meeting",
      },
    },
  ],
};
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript((d) => {
  if (!localStorage.getItem("kimo-os-workspace-v1"))
    localStorage.setItem("kimo-os-workspace-v1", JSON.stringify(d));
}, data);
await page.goto(process.env.KIMO_TEST_URL || "http://localhost:3005");
await page.getByRole("button", { name: "Tasks", exact: true }).click();
await page.getByLabel("Task status", { exact: true }).selectOption("Overdue");
await page
  .locator("button.row-body")
  .filter({ hasText: "Test overdue task" })
  .click();
await page.getByText("Original task notes", { exact: true }).waitFor();
await page.getByRole("button", { name: "Mark complete", exact: false }).click();
await page.reload();
await page.getByRole("button", { name: "Tasks", exact: true }).click();
await page.getByLabel("Task status", { exact: true }).selectOption("Done");
await page.getByText("Test overdue task", { exact: true }).waitFor();
await page.getByLabel("Task status", { exact: true }).selectOption("On Hold");
await page.getByText("Test paused task", { exact: true }).waitFor();
await page.getByRole("button", { name: "Pipeline", exact: true }).click();
assert.equal(await page.locator(".pipeline-record").count(), 1);
await page
  .locator(".pipeline-record summary")
  .filter({ hasText: "Test opportunity" })
  .waitFor();
assert.match(await page.locator(".business-metrics").innerText(), /10\.0%/);
await page.getByLabel("Pipeline source").selectOption("s2");
await page
  .locator(".pipeline-record summary")
  .filter({ hasText: "Duplicate source record" })
  .waitFor();
await page
  .getByRole("button", { name: "Leads & contacts", exact: true })
  .click();
await page
  .locator(".pipeline-record summary")
  .filter({ hasText: "Test prospect" })
  .click();
await page.getByText("test@example.test", { exact: true }).waitFor();
await page.setViewportSize({ width: 390, height: 844 });
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "Business browser checks passed: task filters, source notes, saved completion, single-source pipeline, contacts, mobile.",
);
