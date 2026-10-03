import type { Action, Workspace, CompanyId } from "@/domain/models";
import type { SourceRecord } from "./business-import";
export function sourceField(record: SourceRecord, ...names: string[]): string {
  const wanted = names.map((n) => n.toLowerCase().trim());
  return (
    Object.entries(record.fields).find(([key]) =>
      wanted.includes(
        key
          .replace(/^\d+\.\s*/, "")
          .trim()
          .toLowerCase(),
      ),
    )?.[1] ?? ""
  );
}
// Invalid/missing/ambiguous financial values stay unknown, never zero.
export function sourceMoney(value: string): number | undefined {
  let text = value
    .trim()
    .replace(/^([+-]?)(?:IDR|Rp\.?)\s*/i, "$1")
    .replace(/\s/g, "");
  if (!text || /[#A-Za-z]/.test(text)) return undefined;
  const negative = /^\(.*\)$/.test(text);
  if (negative) text = text.slice(1, -1);
  if (/^[-+]?\d+(\.\d+)?$/.test(text))
    return (negative ? -1 : 1) * Number(text);
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text))
    return (negative ? -1 : 1) * Number(text.replace(/,/g, ""));
  if (/^[-+]?\d{1,3}(\.\d{3})+,\d+$/.test(text))
    return (
      (negative ? -1 : 1) * Number(text.replace(/\./g, "").replace(",", "."))
    );
  return undefined;
}
export function taskStatus(action: Action) {
  return action.status === "Done" ? "Done" : action.sourceStatus || "Open";
}
export function overdue(action: Action, day: string) {
  return (
    action.status === "Open" &&
    /^\d{4}-\d{2}-\d{2}$/.test(action.dueDate) &&
    action.dueDate < day
  );
}
export function visibleTasks(data: Workspace, company?: CompanyId) {
  return data.actions.filter(
    (a) =>
      !company ||
      data.projects.find((p) => p.id === a.project)?.company === company,
  );
}
export function commercialTotals(records: SourceRecord[]) {
  const values = records.map((r) => ({
    revenue: sourceMoney(sourceField(r, "Expected Revenue")),
    profit: sourceMoney(sourceField(r, "Profit")),
  }));
  const revenue = values.filter((v) => v.revenue !== undefined);
  const profit = values.filter((v) => v.profit !== undefined);
  const knownPairs = values.filter(
    (v) => v.revenue !== undefined && v.profit !== undefined,
  );
  const pairRevenue = knownPairs.reduce((sum, v) => sum + v.revenue!, 0);
  return {
    revenue: revenue.reduce((sum, v) => sum + v.revenue!, 0),
    profit: profit.reduce((sum, v) => sum + v.profit!, 0),
    revenueMissing: values.length - revenue.length,
    profitMissing: values.length - profit.length,
    margin:
      pairRevenue === 0
        ? undefined
        : knownPairs.reduce((sum, v) => sum + v.profit!, 0) / pairRevenue,
    marginRows: knownPairs.length,
  };
}
