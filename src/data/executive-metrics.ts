import type { Metric } from "@/domain/executive";
// Demonstration data, isolated from the operational workspace and never persisted.
const units = [
  { company: "studio" as const, node: "ggi", share: 0.43 },
  { company: "studio" as const, node: "ggs", share: 0.22 },
  { company: "studio" as const, node: "other-clients", share: 0.1 },
  { company: "originals" as const, node: "fam", share: 0.09 },
  { company: "originals" as const, node: "the-others", share: 0.04 },
  { company: "originals" as const, node: "camponaria", share: 0.03 },
  { company: "originals" as const, node: "medium-format", share: 0.09 },
];
const totals = [0.72, 1.12, 1.4, 1.32, 1.85, 2.4, 2.12, 2.23, 2.76];
export const sampleRevenue: Metric[] = [2025, 2026].flatMap((year) =>
  totals.flatMap((amount, index) => {
    const days = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
    return Array.from({ length: days }, (_, d) =>
      units.map((u) => ({
        id: `${year}-${index}-${d}-${u.node}`,
        company: u.company,
        node: u.node,
        date: `${year}-${String(index + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`,
        value: ((amount * 1e9 * u.share) / days) * (year === 2025 ? 0.82 : 1),
        currency: "IDR" as const,
        kind: "revenue" as const,
        provenance: "sample" as const,
      })),
    ).flat();
  }),
);
