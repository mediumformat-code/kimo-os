import { Workspace, CompanyId } from "@/domain/models";
import { emptyWorkspace, operatingDate } from "./import-workspace";
export interface SourceSheet {
  id: string;
  file: string;
  title: string;
  rows: string[][];
}
export interface SourceRecord {
  id: string;
  sheet: string;
  row: number;
  kind: "task" | "lead" | "commercial" | "project";
  fields: Record<string, string>;
  project?: string;
}
const norm = (s: string) => s.trim().toLowerCase();
export const finishedStatus = (s: string) =>
  /^(completed|done|cancelled|canceled|declined|lost|1_done|5_lost)$/i.test(
    s.trim(),
  );
export function prepareBusinessSheets(sheets: SourceSheet[]): Workspace {
  const data = emptyWorkspace();
  data.sourceSheets = sheets;
  data.sourceRecords = [];
  data.metadata = {
    dataset: "live",
    importedAt: new Date().toISOString(),
    sourceName: "DDO / DDS Excel & Google sources",
  };
  const today = operatingDate(data);
  const people = new Map<string, Workspace["people"][number]>();
  const person = (
    name: string,
    company: CompanyId,
    project?: string,
    role = "Source contact",
  ) => {
    if (!name.trim()) return;
    const key = company + ":" + norm(name);
    let p = people.get(key);
    if (!p) {
      p = {
        id: `source-person-${people.size + 1}`,
        name: name.trim(),
        company,
        role,
        projects: [],
        lastInteraction: "",
        nextUpdate: "",
      };
      people.set(key, p);
    }
    if (project && !p.projects.includes(project)) p.projects.push(project);
  };
  for (const sheet of sheets) {
    if (/^_|^copy of/i.test(sheet.title)) continue;
    const h = sheet.rows.findIndex(
      (r, i) =>
        i < 30 &&
        (r.some((c) => norm(c) === "task title") ||
          r.some((c) => norm(c) === "project name") ||
          (r.some((c) => norm(c) === "company") &&
            r.some((c) => norm(c) === "commercial pic"))),
    );
    if (h < 0) continue;
    const headers = sheet.rows[h];
    const get = (r: string[], ...names: string[]) => {
      const i = headers.findIndex((c) => names.includes(norm(c)));
      return i < 0 ? "" : (r[i] ?? "").trim();
    };
    const task = headers.some((c) => norm(c) === "task title");
    const lead = headers.some((c) => norm(c) === "commercial pic");
    const commercial =
      !task && !lead && !headers.some((c) => norm(c) === "pic");
    if (
      commercial &&
      sheet.title !== "Pipeline 2026 Detail" &&
      sheets.some(
        (s) => s.file === sheet.file && s.title === "Pipeline 2026 Detail",
      )
    )
      continue;
    for (let row = h + 1; row < sheet.rows.length; row++) {
      const r = sheet.rows[row];
      const title = get(
        r,
        task ? "task title" : lead ? "company" : "project name",
      );
      if (
        !title ||
        /^(last update|total|grand total|project name)$/i.test(title)
      )
        continue;
      const fields: Record<string, string> = {};
      headers.forEach((c, j) => {
        if (r[j]) fields[`${j + 1}. ${c.trim() || "Column"}`] = r[j];
      });
      const id = `${sheet.id}-row-${row + 1}`;
      const rec: SourceRecord = {
        id,
        sheet: sheet.id,
        row: row + 1,
        kind: task
          ? "task"
          : lead
            ? "lead"
            : commercial
              ? "commercial"
              : "project",
        fields,
      };
      data.sourceRecords.push(rec);
      if (lead) {
        person(
          get(r, "name"),
          "studio",
          undefined,
          `Client contact · ${title} · ${get(r, "emal", "email")}`,
        );
        person(get(r, "commercial pic"), "studio", undefined, "Commercial PIC");
        continue;
      }
      if (commercial) {
        person(get(r, "account"), "studio", undefined, "Commercial account");
        continue;
      }
      const company: CompanyId = task ? "originals" : "studio";
      const owner = get(r, task ? "beliau" : "pic") || "Unassigned";
      const name = task
        ? get(r, "workspace") || "DDO — ungrouped tasks"
        : title;
      const projectId = task
        ? `${sheet.id}-workspace-${encodeURIComponent(norm(name))}`
        : id;
      let p = data.projects.find((p) => p.id === projectId);
      const status = get(r, "status") || "Unspecified";
      const priority =
        (
          { urgent: 100, high: 80, medium: 60, normal: 50, low: 30 } as Record<
            string,
            number
          >
        )[norm(get(r, "priority"))] ?? 50;
      if (!p) {
        p = {
          id: projectId,
          name,
          company,
          owner: task ? "Unassigned" : owner,
          status: task ? "Active" : status,
          priority,
          deadline: task ? "" : get(r, "tanggal akhir", "due date"),
          health: "Watch",
          latestUpdate: task ? "" : get(r, "progress task"),
          nextAction: "",
          blockers: [],
          people: [],
          meetings: [],
          documents: [],
        };
        data.projects.push(p);
      }
      rec.project = projectId;
      const members = (
        task ? owner : [owner, get(r, "team")].filter(Boolean).join(",")
      )
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter((s) => s && s !== "Unassigned");
      for (const m of members) {
        if (!p.people.includes(m)) p.people.push(m);
        person(m, company, projectId, task ? "Task PIC" : "Project team");
      }
      const docs = task
        ? get(r, "deliverables")
        : [
            get(r, "deck (slides link)"),
            get(r, "masterfile (sheets link)"),
            get(r, "one pager & mom (docs link)"),
          ]
            .filter(Boolean)
            .join("\n");
      if (docs && !p.documents.includes(docs)) p.documents.push(docs);
      if (task) {
        const due = get(r, "due date");
        data.actions.push({
          id,
          description: title,
          owner,
          dueDate: due,
          project: projectId,
          priority,
          status: finishedStatus(status) ? "Done" : "Open",
          horizon: due && due <= today ? "Today" : "Later",
          sourceStatus: status,
          sourceRef: id,
        });
      }
    }
  }
  for (const p of data.projects.filter((p) => p.company === "originals")) {
    const tasks = data.actions.filter((a) => a.project === p.id);
    const owners = [
      ...new Set(tasks.map((t) => t.owner).filter((o) => o !== "Unassigned")),
    ];
    p.owner = owners.join(" / ") || "Unassigned";
    p.status = tasks.every((t) => t.status === "Done")
      ? "Completed"
      : tasks
            .filter((t) => t.status === "Open")
            .every((t) => t.sourceStatus === "On Hold")
        ? "On Hold"
        : "Active";
    p.priority = Math.max(...tasks.map((t) => t.priority));
    p.latestUpdate = `${tasks.filter((t) => t.status === "Done").length}/${tasks.length} task selesai`;
  }
  data.people = [...people.values()];
  return data;
}
