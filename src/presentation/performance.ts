import type { Metric } from "@/domain/executive";
export type Timeframe = "Month" | "Quarter" | "Year";
export const money = (n: number) =>
  `Rp ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`;
const inNode = (m: Metric, node?: string) =>
  !node ||
  m.node === node ||
  (node === "event-ip" && ["the-others", "camponaria"].includes(m.node)) ||
  (node === "retail" && m.node === "medium-format");
export function performance(
  metrics: Metric[],
  timeframe: Timeframe,
  company?: string,
  node?: string,
) {
  const scoped = metrics.filter(
    (m) => (!company || m.company === company) && inNode(m, node),
  );
  const latest = scoped
    .map((m) => m.date)
    .sort()
    .at(-1);
  if (!latest)
    return {
      points: [],
      total: undefined,
      previous: undefined,
      growth: undefined,
      period: "Not reported",
      split: [] as { name: string; value: number; node: string }[],
    };
  const [year, month] = latest.split("-").map(Number);
  const start =
    timeframe === "Year"
      ? 1
      : timeframe === "Quarter"
        ? Math.floor((month - 1) / 3) * 3 + 1
        : month;
  const selected = scoped.filter(
    (m) =>
      +m.date.slice(0, 4) === year &&
      +m.date.slice(5, 7) >= start &&
      +m.date.slice(5, 7) <= month,
  );
  const prev = scoped.filter(
    (m) =>
      +m.date.slice(0, 4) === year - 1 &&
      +m.date.slice(5, 7) >= start &&
      +m.date.slice(5, 7) <= month,
  );
  const total = selected.reduce((s, m) => s + m.value, 0);
  const previous = prev.reduce((s, m) => s + m.value, 0);
  const count =
    timeframe === "Month"
      ? new Date(Date.UTC(year, month, 0)).getUTCDate()
      : month - start + 1;
  const points = Array.from({ length: count }, (_, i) => {
    const target = timeframe === "Month" ? i + 1 : start + i;
    const sum = (rows: Metric[]) =>
      rows
        .filter(
          (m) =>
            +(timeframe === "Month"
              ? m.date.slice(8, 10)
              : m.date.slice(5, 7)) === target,
        )
        .reduce((s, m) => s + m.value, 0);
    return {
      label:
        timeframe === "Month"
          ? String(i + 1)
          : new Intl.DateTimeFormat("en", {
              month: "short",
              timeZone: "UTC",
            }).format(new Date(Date.UTC(year, start + i - 1, 1))),
      current: sum(selected),
      previous: sum(prev),
    };
  });
  const names: Record<string, string> = {
    studio: "Double Deer Studio",
    originals: "Double Deer Originals",
    ggi: "Gudang Garam International",
    ggs: "Gudang Garam Signature",
    "other-clients": "Other client accounts",
    fam: "FAM",
    "event-ip": "Event IP",
    retail: "Retail",
    "the-others": "The Others",
    camponaria: "Camponaria",
    "medium-format": "Medium Format",
  };
  const values = new Map<string, number>();
  for (const m of selected) {
    const group = !company
      ? m.company
      : company === "studio"
        ? m.node
        : node === "event-ip" || node === "retail"
          ? m.node
          : m.node === "medium-format"
            ? "retail"
            : ["the-others", "camponaria"].includes(m.node)
              ? "event-ip"
              : "fam";
    values.set(group, (values.get(group) ?? 0) + m.value);
  }
  return {
    points,
    total,
    previous,
    growth: previous ? ((total - previous) / previous) * 100 : undefined,
    period:
      timeframe === "Month"
        ? new Intl.DateTimeFormat("en", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(Date.UTC(year, month - 1, 1)))
        : timeframe === "Quarter"
          ? `Q${Math.ceil(month / 3)} ${year}`
          : `Jan–${points.at(-1)?.label} ${year}`,
    split: [...values].map(([node, value]) => ({
      node,
      name: names[node] ?? node,
      value,
    })),
  };
}
