import type { Workspace } from "@/domain/models";
import { mockWorkspace } from "@/data/mock";

/** Remove seeded records by identity, never by a real person's/project's name alone. */
export function removeDemo(raw: Workspace): Workspace {
  const data = structuredClone(raw);
  const seeded = new Set(
    mockWorkspace.projects
      .filter((seed) =>
        raw.projects.some(
          (p) =>
            p.id === seed.id && p.name === seed.name && p.owner === seed.owner,
        ),
      )
      .map((p) => p.id),
  );
  data.projects = data.projects.filter((p) => !seeded.has(p.id));
  const ids = new Set(data.projects.map((p) => p.id));
  for (const key of [
    "actions",
    "decisions",
    "commitments",
    "meetings",
    "risks",
    "inbox",
  ] as const) {
    const seedIds = new Set(mockWorkspace[key].map((record) => record.id));
    data[key] = data[key].filter(
      (record) =>
        !seeded.has(record.project) &&
        !(seedIds.has(record.id) && !ids.has(record.project)),
    ) as never;
  }
  const seedPeople = new Set(mockWorkspace.people.map((p) => p.id));
  data.people = data.people
    .filter(
      (p) => !seedPeople.has(p.id) || p.projects.some((id) => ids.has(id)),
    )
    .map((p) => ({ ...p, projects: p.projects.filter((id) => ids.has(id)) }));
  data.metadata = { ...data.metadata, dataset: "live" };
  return data;
}
