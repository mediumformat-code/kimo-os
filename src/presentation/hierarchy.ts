import type { CompanyId, Project, Workspace } from "@/domain/models";
import type {
  BusinessUnit,
  ClientAccount,
  ProjectPlacement,
} from "@/domain/executive";
export const companies = [
  {
    id: "studio" as const,
    name: "Double Deer Studio",
    label: "DD Studio",
    initials: "DS",
  },
  {
    id: "originals" as const,
    name: "Double Deer Originals",
    label: "DD Originals",
    initials: "DO",
  },
];
export const businessUnits: BusinessUnit[] = [
  {
    id: "fam",
    company: "originals",
    name: "Frekuensi Antara Music",
    shortLabel: "FAM",
  },
  {
    id: "event-ip",
    company: "originals",
    name: "Event IP",
    shortLabel: "Event IP",
  },
  { id: "retail", company: "originals", name: "Retail", shortLabel: "Retail" },
];
export const clientAccounts: ClientAccount[] = [
  { id: "ggi", company: "studio", name: "Gudang Garam International" },
  { id: "ggs", company: "studio", name: "Gudang Garam Signature" },
  { id: "other-clients", company: "studio", name: "Other client accounts" },
];
export const excludedAccount = (name: string) =>
  /(?:^|\W)(?:by[.\s-]?u|a[\s.-]?mild)(?:\W|$)/i.test(name);
export function placement(
  project: Pick<Project, "company" | "name">,
): ProjectPlacement {
  const n = project.name.toLowerCase();
  const original =
    project.company === "originals" ||
    /medium format|frekuensi|\bfam\b|camponaria|the others/.test(n);
  if (!original)
    return {
      company: "studio",
      node: /international|\bggi\b/.test(n)
        ? "ggi"
        : /signature|\bggs\b/.test(n)
          ? "ggs"
          : "other-clients",
      group: "Client accounts",
      label: /international|\bggi\b/.test(n)
        ? clientAccounts[0].name
        : /signature|\bggs\b/.test(n)
          ? clientAccounts[1].name
          : "Other client accounts",
    };
  if (/medium format|ecommerce|retail/.test(n))
    return {
      company: "originals",
      node: "medium-format",
      group: "Retail",
      label: "Medium Format",
    };
  if (/frekuensi|\bfam\b|music|artist|catalog|distribution/.test(n))
    return {
      company: "originals",
      node: "fam",
      group: "Frekuensi Antara Music",
      label: "FAM",
    };
  if (/camponaria/.test(n))
    return {
      company: "originals",
      node: "camponaria",
      group: "Event IP",
      label: "Camponaria",
    };
  if (/the others/.test(n))
    return {
      company: "originals",
      node: "the-others",
      group: "Event IP",
      label: "The Others",
    };
  return {
    company: "originals",
    node: "originals-other",
    group: "Unclassified work",
    label: "Needs classification",
  };
}
export function nodeMatches(p: Project, node?: string) {
  const h = placement(p);
  return (
    !node ||
    h.node === node ||
    (node === "event-ip" && h.group === "Event IP") ||
    (node === "retail" && h.group === "Retail")
  );
}
// Presentation projection only. Never pass it to workspace persistence or sync.
export function executiveWorkspace(raw: Workspace): Workspace {
  const sample = raw.metadata?.dataset !== "live";
  const data: Workspace = sample
    ? JSON.parse(JSON.stringify(raw).replaceAll("COMMONS", "The Others"))
    : structuredClone(raw);
  const aliases: Record<string, { name: string; company: CompanyId }> = {
    amild: { name: "Camponaria", company: "originals" },
    byu: { name: "FAM · Distribution", company: "originals" },
    commons: { name: "The Others", company: "originals" },
    frekuensi: { name: "Frekuensi Antara Music", company: "originals" },
    music: { name: "FAM · Artist investment", company: "originals" },
  };
  data.projects = data.projects
    .filter((p) => sample || !excludedAccount(p.name))
    .map((p) => {
      const a = sample ? aliases[p.id] : undefined;
      const candidate = { ...p, ...a };
      return { ...candidate, company: placement(candidate).company };
    });
  data.companies = companies.map((c) => ({
    id: c.id,
    name: c.name,
    description:
      c.id === "studio"
        ? "Agency · clients · activation"
        : "Music · Event IP · Retail",
  }));
  const ids = new Set(data.projects.map((p) => p.id));
  for (const key of [
    "actions",
    "decisions",
    "commitments",
    "meetings",
    "risks",
    "inbox",
  ] as const)
    data[key] = data[key].filter((e) => ids.has(e.project)) as never;
  data.people = data.people.map((p) => ({
    ...p,
    company: (() => {
      const owned = data.projects.filter((project) =>
        p.projects.includes(project.id),
      );
      const groups = new Set(owned.map((project) => project.company));
      return groups.size === 1
        ? owned[0].company
        : p.company === "shared"
          ? "studio"
          : p.company;
    })(),
    projects: p.projects.filter((id) => ids.has(id)),
  }));
  data.sourceRecords = data.sourceRecords?.filter(
    (r) =>
      !Object.values(r.fields).some((v) => excludedAccount(v)) &&
      (!r.project || ids.has(r.project)),
  );
  return data;
}
export function scopeExecutive(
  data: Workspace,
  company?: CompanyId,
  node?: string,
): Workspace {
  if (!company && !node) return data;
  const scoped = {
    ...data,
    projects: data.projects.filter(
      (p) => (!company || p.company === company) && nodeMatches(p, node),
    ),
  };
  const ids = new Set(scoped.projects.map((p) => p.id));
  for (const key of [
    "actions",
    "decisions",
    "commitments",
    "meetings",
    "risks",
    "inbox",
  ] as const)
    scoped[key] = data[key].filter((e) => ids.has(e.project)) as never;
  scoped.people = data.people.filter((p) =>
    node
      ? p.projects.some((id) => ids.has(id))
      : !company || p.company === company,
  );
  return scoped;
}
export const activeProject = (p: Project) =>
  !/(?:completed|cancelled|canceled|archived|lost|\bdone\b|1_paid|9_lost|blocked)/i.test(
    p.status,
  );
