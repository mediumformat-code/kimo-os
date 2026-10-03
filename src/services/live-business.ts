import type { Workspace } from "@/domain/models";
import { isWorkspace } from "./validation";
import { prepareBusinessSheets, SourceSheet } from "./business-import";
export interface BusinessSyncState {
  enabled: boolean;
  lastSyncedAt: string;
  sourceHash: string;
  projectIds: string[];
  actionIds: string[];
  personIds: string[];
  recordIds: string[];
  sheetIds: string[];
  warnings: string[];
}
export function normalizeSourceDate(text: string): string {
  const v = text.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (!match) return v;
  const iso = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const d = new Date(iso + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso
    ? iso
    : v;
}
export function liveSourceId(sheet: SourceSheet, row: number): string {
  const h =
    sheet.rows.find((r) =>
      r.some((c) =>
        /^(task title|project name|commercial pic)$/i.test(c.trim()),
      ),
    ) ?? [];
  const key = h.findIndex((c) => c.trim() === "KIMO Row Key");
  const value = key < 0 ? "" : sheet.rows[row][key]?.trim();
  if (!value)
    throw new Error(
      `${sheet.title}: row ${row + 1} belum memiliki KIMO Row Key. Jalankan Refine source sheets dulu.`,
    );
  return `${sheet.id}:key:${value}`;
}
export function prepareLiveBusiness(sheets: SourceSheet[]): Workspace {
  const incoming = prepareBusinessSheets(sheets);
  if (
    !incoming.sourceRecords?.some((r) => r.kind === "task") ||
    !incoming.sourceRecords.some((r) => r.kind === "project") ||
    !incoming.sourceRecords.some((r) => r.kind === "commercial")
  )
    throw new Error(
      "Sumber task DDO, proyek DDS, dan commercial harus terbaca lengkap. Workspace tidak diubah.",
    );
  return incoming;
}
export function mergeLiveBusiness(
  current: Workspace,
  incoming: Workspace,
  sourceHash: string,
  warnings: string[],
): Workspace {
  const sample = current.metadata?.dataset !== "live" && !current.businessSync;
  const next = structuredClone(sample ? incoming : current);
  const state = current.businessSync;
  const imported = current.sourceRecords ?? [];
  const oldProjects = new Set(
    state?.projectIds ??
      imported.flatMap((r) => (r.project ? [r.project] : [])),
  );
  const oldActions = new Set(
    state?.actionIds ??
      current.actions.filter((a) => a.sourceRef).map((a) => a.id),
  );
  const oldPeople = new Set(
    state?.personIds ??
      current.people
        .filter((p) => p.id.startsWith("source-person-"))
        .map((p) => p.id),
  );
  const candidate = structuredClone(incoming);
  const map = new Map<string, string>();
  for (const p of candidate.projects) {
    const old = current.projects.filter(
      (o) =>
        oldProjects.has(o.id) && o.company === p.company && o.name === p.name,
    );
    if (old.length === 1) map.set(p.id, old[0].id);
  }
  for (const p of candidate.projects) {
    p.id = map.get(p.id) ?? p.id;
    const previous = !sample && current.projects.find((old) => old.id === p.id);
    if (previous) {
      p.health = previous.health;
      p.blockers = previous.blockers;
      p.nextAction = previous.nextAction;
      p.meetings = previous.meetings;
    }
  }
  for (const a of candidate.actions)
    a.project = map.get(a.project) ?? a.project;
  for (const r of candidate.sourceRecords ?? [])
    if (r.project) r.project = map.get(r.project) ?? r.project;
  for (const p of candidate.people)
    p.projects = p.projects.map((id) => map.get(id) ?? id);
  const incomingIds = new Set(candidate.projects.map((p) => p.id));
  const retained = sample
    ? []
    : current.projects
        .filter(
          (p) =>
            !oldProjects.has(p.id) ||
            (!incomingIds.has(p.id) &&
              [
                ...current.decisions,
                ...current.meetings,
                ...current.commitments,
                ...current.risks,
                ...current.inbox,
                ...current.actions.filter((a) => !oldActions.has(a.id)),
              ].some((e) => e.project === p.id)),
        )
        .map((p) =>
          oldProjects.has(p.id) && !incomingIds.has(p.id)
            ? { ...p, status: "Archived — removed from source" }
            : p,
        );
  next.projects = [...retained, ...candidate.projects];
  next.actions = [
    ...(sample ? [] : current.actions.filter((a) => !oldActions.has(a.id))),
    ...candidate.actions,
  ];
  next.people = [
    ...(sample ? [] : current.people.filter((p) => !oldPeople.has(p.id))),
    ...candidate.people,
  ];
  next.sourceRecords = candidate.sourceRecords;
  next.sourceSheets = candidate.sourceSheets;
  next.metadata = {
    ...incoming.metadata,
    dataset: "live",
    sourceName: "Live Google Sheets — DDO / DDS",
  };
  next.businessSync = {
    enabled: true,
    lastSyncedAt: new Date().toISOString(),
    sourceHash,
    projectIds: candidate.projects.map((p) => p.id),
    actionIds: candidate.actions.map((a) => a.id),
    personIds: candidate.people.map((p) => p.id),
    recordIds: (candidate.sourceRecords ?? []).map((r) => r.id),
    sheetIds: (candidate.sourceSheets ?? []).map((s) => s.id),
    warnings,
  };
  if (!isWorkspace(next))
    throw new Error(
      "Sinkronisasi menghasilkan relasi yang tidak valid. Data lama dipertahankan.",
    );
  return next;
}
