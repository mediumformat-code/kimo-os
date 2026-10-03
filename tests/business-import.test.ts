import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareBusinessSheets } from "../src/services/business-import";
import { isWorkspace } from "../src/services/validation";
import { topPriorities } from "../src/services/workspace";
test("DDO groups tasks while preserving duplicate source IDs, status and notes", () => {
  const d = prepareBusinessSheets([
    {
      id: "ddo",
      file: "task.xlsx",
      title: "DDO TASK",
      rows: [
        [
          "ID",
          "Workspace",
          "Task Title",
          "Beliau",
          "Status",
          "Priority",
          "Due Date",
          "TDL Notes",
        ],
        [
          "same",
          "Brand",
          "Finished task",
          "PIC",
          "Completed",
          "High",
          "2026-09-01",
          "Done notes",
        ],
        [
          "same",
          "Brand",
          "Paused task",
          "PIC",
          "On Hold",
          "Urgent",
          "",
          "Paused notes",
        ],
      ],
    },
  ]);
  assert.ok(isWorkspace(d));
  assert.equal(d.projects.length, 1);
  assert.equal(d.actions.length, 2);
  assert.notEqual(d.actions[0].id, d.actions[1].id);
  assert.equal(d.actions[0].status, "Done");
  assert.equal(d.actions[1].sourceStatus, "On Hold");
  assert.equal(topPriorities(d).length, 0);
  assert.equal(d.sourceRecords?.[1].fields["8. TDL Notes"], "Paused notes");
});
test("DDS preserves contacts and commercial money without inventing projects or totals", () => {
  const d = prepareBusinessSheets([
    {
      id: "lead",
      file: "dds",
      title: "Seedlist 2026",
      rows: [
        ["Last Updated"],
        ["Company", "Name", "Email", "Commercial PIC", "Status"],
        ["Client", "Contact", "mail@example.test", "PIC", "Meeting"],
      ],
    },
    {
      id: "bc",
      file: "bc",
      title: "Pipeline 2026 Detail",
      rows: [
        ["Summary"],
        ["Project Name", "Client", "Account", "Expected Revenue", "Status"],
        ["Job", "Client", "PIC", "0", "1_Done"],
      ],
    },
    {
      id: "archive",
      file: "dds",
      title: "Copy of Project Pipeline 2026",
      rows: [
        ["Project Name", "PIC"],
        ["Old job", "PIC"],
      ],
    },
  ]);
  assert.equal(d.projects.length, 0);
  assert.equal(d.sourceRecords?.length, 2);
  assert.equal(d.sourceRecords?.[1].fields["4. Expected Revenue"], "0");
  assert.equal(d.sourceSheets?.length, 3);
  assert.ok(d.people.some((p) => p.name === "Contact"));
  assert.ok(isWorkspace(d));
});
test("DDS operational projects retain status, team, deadline and source provenance", () => {
  const d = prepareBusinessSheets([
    {
      id: "dds",
      file: "dds",
      title: "Project Pipeline 2026",
      rows: [
        [
          "Project Name",
          "PIC",
          "Team",
          "Status",
          "Tanggal akhir",
          "Progress Task",
        ],
        ["Last Update", "Date"],
        ["Job", "PIC", "A, B", "Cancelled", "2026-03-01", "Notes"],
      ],
    },
  ]);
  assert.equal(d.projects.length, 1);
  assert.equal(d.projects[0].status, "Cancelled");
  assert.equal(d.projects[0].deadline, "2026-03-01");
  assert.deepEqual(d.projects[0].people, ["PIC", "A", "B"]);
  assert.equal(d.sourceRecords?.[0].row, 3);
  assert.ok(isWorkspace(d));
});
