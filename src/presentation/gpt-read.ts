import type { Workspace } from "@/domain/models";
export const readSections = [
  "projects",
  "people",
  "actions",
  "decisions",
  "commitments",
  "meetings",
  "risks",
  "inbox",
  "sourceRecords",
  "sourceSheets",
] as const;
export function readWorkspace(workspace: Workspace, params: URLSearchParams) {
  const section = params.get("section") || "overview";
  if (
    section !== "overview" &&
    !readSections.includes(section as (typeof readSections)[number])
  )
    throw new Error("Unknown section.");
  const integer = (key: string, fallback: number, max: number) => {
    const v = params.get(key);
    if (v === null) return fallback;
    const n = Number(v);
    if (!Number.isSafeInteger(n) || n < 0 || n > max)
      throw new Error(`Invalid ${key}.`);
    return n;
  };
  const offset = integer("offset", 0, 10000000);
  const limit = Math.max(1, integer("limit", 5, 10));
  const counts = Object.fromEntries(
    readSections.map((key) => [key, (workspace[key] ?? []).length]),
  );
  const compact = (value: unknown, depth = 0): unknown => {
    if (typeof value === "string")
      return value.length > 300
        ? value.slice(0, 300) + "… [preview truncated]"
        : value;
    if (depth > 4) return "[nested data omitted; read record by id]";
    if (Array.isArray(value))
      return value.slice(0, 5).map((v) => compact(v, depth + 1));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .slice(0, 20)
          .map(([k, v]) => [k, compact(v, depth + 1)]),
      );
    return value;
  };
  if (section === "overview")
    return {
      partial: true,
      counts,
      companies: compact(workspace.companies),
      projects: workspace.projects
        .slice(0, 10)
        .map((p) => ({
          id: p.id,
          name: p.name.slice(0, 150),
          company: p.company,
          owner: p.owner.slice(0, 100),
          status: p.status.slice(0, 100),
        })),
      instructions:
        "Read sections using section, offset and limit. List records are previews. Read complete records using section + id; concatenate serializedRecordChunk parts by nextOffset, then parse JSON. Never create a replacement proposal from partial data.",
    };
  const records = (workspace[section as (typeof readSections)[number]] ??
    []) as { id: string }[];
  const id = params.get("id");
  if (id) {
    const record = records.find((r) => r.id === id);
    if (!record) throw new Error("Record not found.");
    const serialized = JSON.stringify(record);
    const end = Math.min(serialized.length, offset + 4000);
    return {
      section,
      id,
      partial: true,
      serializedRecordChunk: serialized.slice(offset, end),
      offset,
      nextOffset: end < serialized.length ? end : null,
      totalCharacters: serialized.length,
      completeRecord: offset === 0 && end === serialized.length,
    };
  }
  const items: unknown[] = [];
  let index = offset;
  while (index < records.length && items.length < limit) {
    const item = compact(records[index]);
    if (JSON.stringify([...items, item]).length > 16000) {
      if (!items.length)
        items.push({
          id: records[index].id,
          note: "Large record; read by id.",
        });
      else break;
    } else items.push(item);
    index++;
  }
  return {
    section,
    partial: true,
    items,
    total: records.length,
    offset,
    nextOffset: index < records.length ? index : null,
    instructions:
      "Items are previews. Use section and id to read full record in chunks. Preserve all unread records.",
  };
}
