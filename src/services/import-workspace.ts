import { Workspace, CompanyId } from "@/domain/models";
import { isWorkspace } from "./validation";
export function emptyWorkspace(): Workspace {
  return {
    companies: [
      { id: "studio", name: "DD Studio", description: "DDS" },
      { id: "originals", name: "DD Originals", description: "DDO" },
      { id: "shared", name: "Shared / Group", description: "Group functions" },
    ],
    projects: [],
    people: [],
    commitments: [],
    decisions: [],
    meetings: [],
    actions: [],
    risks: [],
    inbox: [],
    metadata: { dataset: "live" },
  };
}
const companyMap: Record<string, CompanyId> = {
  DDS: "studio",
  DDO: "originals",
  studio: "studio",
  originals: "originals",
  shared: "shared",
  "DD Studio": "studio",
  "DD Originals": "originals",
  Shared: "shared",
};
export function prepareWorkspaceImport(
  text: string,
  sourceName: string,
): Workspace {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      text
        .trim()
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, ""),
    );
  } catch {
    throw new Error(
      "Format belum valid. Gunakan JSON workspace atau JSON daftar proyek dari GPT.",
    );
  }
  if (isWorkspace(parsed))
    return {
      ...parsed,
      metadata: {
        dataset: "live",
        importedAt: new Date().toISOString(),
        sourceName,
      },
    };
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { projects?: unknown }).projects)
  )
    throw new Error("Data harus memiliki daftar projects.");
  if (
    [
      "companies",
      "people",
      "actions",
      "decisions",
      "commitments",
      "meetings",
      "risks",
      "inbox",
    ].some((k) => k in (parsed as Record<string, unknown>))
  )
    throw new Error(
      "JSON workspace lengkap tidak valid. Perbaiki relasi/field yang salah; data tidak akan diimpor sebagian.",
    );
  const data = emptyWorkspace();
  const projects = (parsed as { projects: unknown[] }).projects;
  for (const [index, raw] of projects.entries()) {
    if (!raw || typeof raw !== "object")
      throw new Error(`Proyek ${index + 1} tidak valid.`);
    const p = raw as Record<string, unknown>;
    if (
      typeof p.name !== "string" ||
      !p.name.trim() ||
      typeof p.owner !== "string" ||
      !p.owner.trim() ||
      typeof p.company !== "string" ||
      !companyMap[p.company]
    )
      throw new Error(
        `Proyek ${index + 1}: name, owner, dan company (DDS/DDO/Shared) wajib diisi.`,
      );
    const string = (key: string) =>
      typeof p[key] === "string" ? (p[key] as string) : "";
    const health = ["On track", "Watch", "At risk"].includes(string("health"))
      ? (string("health") as "On track" | "Watch" | "At risk")
      : "Watch";
    const id =
      typeof p.id === "string" && p.id.trim() ? p.id : `project-${index + 1}`;
    const owner = p.owner.trim();
    const company = companyMap[p.company];
    data.projects.push({
      id,
      name: p.name.trim(),
      company,
      owner,
      health,
      status: string("status") || "Active",
      priority: typeof p.priority === "number" ? p.priority : 50,
      deadline: string("deadline"),
      latestUpdate: string("latestUpdate"),
      nextAction: string("nextAction"),
      blockers: Array.isArray(p.blockers)
        ? p.blockers.filter((x): x is string => typeof x === "string")
        : [],
      people: [owner],
      meetings: [],
      documents: [],
    });
    const person = data.people.find((person) => person.name === owner);
    if (person) person.projects.push(id);
    else
      data.people.push({
        id: `person-${data.people.length + 1}`,
        name: owner,
        role: "Role not provided",
        company,
        projects: [id],
        lastInteraction: "",
        nextUpdate: "",
      });
  }
  if (!isWorkspace(data))
    throw new Error(
      "Data proyek tidak konsisten. Periksa ID proyek yang duplikat dan nilai priority.",
    );
  if (!data.projects.length)
    throw new Error(
      "Daftar proyek kosong. Untuk mengosongkan workspace, gunakan tombol Clear workspace.",
    );
  data.metadata = {
    dataset: "live",
    importedAt: new Date().toISOString(),
    sourceName,
  };
  return data;
}
export function downloadWorkspace(data: Workspace) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kimo-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function operatingDate(data: Workspace) {
  return data.metadata?.dataset === "live"
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date())
    : "2026-10-03";
}

export function mergeProjectSources(sources: Workspace[]): Workspace {
  const projects = new Map<string, Workspace["projects"][number]>();
  for (const source of sources)
    for (const project of source.projects) {
      const key = project.company + ":" + project.name.trim().toLowerCase();
      const existing = projects.get(key);
      if (existing && existing.owner !== project.owner)
        throw new Error(
          `Owner konflik untuk ${project.name}. Samakan owner di sumber sebelum impor.`,
        );
      if (existing) {
        existing.documents = [
          ...new Set([...existing.documents, ...project.documents]),
        ];
        existing.latestUpdate = [existing.latestUpdate, project.latestUpdate]
          .filter(Boolean)
          .join(" | ");
      } else projects.set(key, structuredClone(project));
    }
  const data = prepareWorkspaceImport(
    JSON.stringify({
      projects: [...projects.values()].map((p, i) => ({
        ...p,
        id: `source-project-${i + 1}`,
      })),
    }),
    "Combined business source sheets",
  );
  data.projects = data.projects.map((p) => ({
    ...p,
    documents:
      [...projects.values()].find(
        (existing) =>
          existing.company === p.company && existing.name === p.name,
      )?.documents ?? [],
  }));
  return data;
}
