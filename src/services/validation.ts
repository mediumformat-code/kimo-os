import type { Workspace } from "@/domain/models";
import { parsePlaudRecording } from "./plaud";
// Reject malformed browser/remote snapshots before rendering. Unknown properties
// are permitted so optional fields can be introduced without breaking old clients.
const fields = {
  companies: ["id", "name", "description"],
  projects: [
    "id",
    "name",
    "company",
    "owner",
    "status",
    "deadline",
    "health",
    "latestUpdate",
    "nextAction",
  ],
  people: ["id", "name", "role", "company", "lastInteraction", "nextUpdate"],
  commitments: [
    "id",
    "owner",
    "description",
    "source",
    "createdAt",
    "deadline",
    "status",
    "project",
  ],
  decisions: [
    "id",
    "issue",
    "context",
    "owner",
    "deadline",
    "status",
    "project",
  ],
  meetings: ["id", "title", "date", "source", "summary", "project"],
  actions: [
    "id",
    "description",
    "owner",
    "dueDate",
    "project",
    "status",
    "horizon",
  ],
  risks: [
    "id",
    "project",
    "description",
    "severity",
    "owner",
    "mitigation",
    "deadline",
  ],
  inbox: ["id", "title", "description", "kind", "source", "project", "status"],
} as const;
const arrays = {
  projects: ["blockers", "people", "meetings", "documents"],
  people: ["projects"],
  decisions: ["options"],
  meetings: [
    "participants",
    "decisions",
    "commitments",
    "actions",
    "risks",
    "followUps",
  ],
} as const;
const enums: Record<string, Record<string, string[]>> = {
  projects: { health: ["On track", "Watch", "At risk"] },
  commitments: { status: ["Open", "Done"] },
  decisions: { status: ["Needs Kimo", "Waiting for others", "Decided"] },
  actions: {
    status: ["Open", "Done"],
    horizon: ["Today", "This week", "Later"],
  },
  risks: { severity: ["High", "Medium"] },
  inbox: { status: ["Review", "Delegate", "Action", "Decision", "Archived"] },
};
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function isWorkspace(value: unknown): value is Workspace {
  if (!object(value)) return false;
  if (value.plaudSources !== undefined) {
    if (!Array.isArray(value.plaudSources)) return false;
    const ids = new Set<string>();
    for (const source of value.plaudSources) {
      try {
        const parsed = parsePlaudRecording(source);
        if (
          !object(source) ||
          parsed.scope !== source.scope ||
          ids.has(parsed.id) ||
          typeof source.syncedAt !== "string" ||
          !Number.isFinite(Date.parse(source.syncedAt)) ||
          !Array.isArray(source.drafts) ||
          !source.drafts.every(
            (d) =>
              object(d) &&
              typeof d.id === "string" &&
              ["Review", "Applied", "Rejected"].includes(d.status as string),
          )
        )
          return false;
        ids.add(parsed.id);
      } catch {
        return false;
      }
    }
  }
  if (value.plaudSync !== undefined) {
    const s = value.plaudSync;
    if (
      !object(s) ||
      typeof s.lastAttemptAt !== "string" ||
      !Number.isInteger(s.attempts) ||
      !["success", "failed"].includes(s.status as string) ||
      s.automatic !== false
    )
      return false;
  }
  for (const [key, required] of Object.entries(fields)) {
    const items = value[key];
    if (!Array.isArray(items)) return false;
    const ids = new Set<string>();
    for (const item of items) {
      if (
        !object(item) ||
        !required.every((field) => typeof item[field] === "string")
      )
        return false;
      const id = item.id as string;
      if (!id || ids.has(id)) return false;
      ids.add(id);
      for (const field of (arrays as Record<string, readonly string[]>)[key] ??
        []) {
        if (
          !Array.isArray(item[field]) ||
          !item[field].every((v: unknown) => typeof v === "string")
        )
          return false;
      }
      for (const [field, choices] of Object.entries(enums[key] ?? {})) {
        if (!choices.includes(item[field] as string)) return false;
      }
      if (
        ["projects", "actions"].includes(key) &&
        !Number.isFinite(item.priority)
      )
        return false;
    }
  }
  if (
    value.metadata !== undefined &&
    (!object(value.metadata) ||
      !["sample", "live"].includes(value.metadata.dataset as string))
  )
    return false;
  if (
    value.sourceSheets !== undefined &&
    (!Array.isArray(value.sourceSheets) ||
      !value.sourceSheets.every(
        (s) =>
          object(s) &&
          ["id", "file", "title"].every((k) => typeof s[k] === "string") &&
          Array.isArray(s.rows) &&
          s.rows.every(
            (r) => Array.isArray(r) && r.every((c) => typeof c === "string"),
          ),
      ))
  )
    return false;
  if (
    value.sourceRecords !== undefined &&
    (!Array.isArray(value.sourceRecords) ||
      !value.sourceRecords.every(
        (r) =>
          object(r) &&
          typeof r.id === "string" &&
          typeof r.sheet === "string" &&
          Number.isInteger(r.row) &&
          ["task", "lead", "commercial", "project"].includes(
            r.kind as string,
          ) &&
          object(r.fields) &&
          Object.values(r.fields).every((v) => typeof v === "string"),
      ))
  )
    return false;
  if (value.businessSync !== undefined) {
    const s = value.businessSync;
    if (
      !object(s) ||
      typeof s.enabled !== "boolean" ||
      typeof s.lastSyncedAt !== "string" ||
      typeof s.sourceHash !== "string" ||
      ![
        "projectIds",
        "actionIds",
        "personIds",
        "recordIds",
        "sheetIds",
        "warnings",
      ].every(
        (k) => Array.isArray(s[k]) && s[k].every((v) => typeof v === "string"),
      )
    )
      return false;
  }
  const workspace = value as unknown as Workspace;
  const projectIds = new Set(workspace.projects.map((p) => p.id));
  const companyIds = new Set(workspace.companies.map((c) => c.id));
  if (
    workspace.companies.some(
      (c) => !["studio", "originals", "shared"].includes(c.id),
    )
  )
    return false;
  if (
    [...workspace.projects, ...workspace.people].some(
      (p) => !companyIds.has(p.company),
    )
  )
    return false;
  if (
    [
      ...workspace.actions,
      ...workspace.decisions,
      ...workspace.commitments,
      ...workspace.risks,
      ...workspace.inbox,
      ...workspace.meetings.filter(
        (m) =>
          !(
            m.project === "" &&
            m.plaudId &&
            workspace.plaudSources?.some(
              (s) => s.id === m.plaudId && s.scope === m.scope,
            )
          ),
      ),
    ].some((i) => !projectIds.has(i.project))
  )
    return false;
  return true;
}
