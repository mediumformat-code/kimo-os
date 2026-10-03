"use client";
import { useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CompanyId, Workspace } from "@/domain/models";
import {
  commercialTotals,
  sourceField,
  sourceMoney,
} from "@/services/business-views";
import { money } from "@/presentation/performance";
export function SourceFinance({
  data,
  company,
}: {
  data: Workspace;
  company?: CompanyId;
}) {
  const all = (data.sourceRecords ?? []).filter(
    (r) => r.kind === "commercial" && company !== "originals",
  );
  const ids = [...new Set(all.map((r) => r.sheet))];
  const [chosen, setChosen] = useState("");
  const sheet = ids.includes(chosen) ? chosen : ids[0];
  const records = all.filter((r) => r.sheet === sheet);
  const totals = commercialTotals(records);
  const grouped = new Map<string, number>();
  for (const r of records) {
    const value = sourceMoney(sourceField(r, "Expected Revenue"));
    if (value === undefined) continue;
    const status = sourceField(r, "Status") || "Unspecified";
    grouped.set(status, (grouped.get(status) ?? 0) + value);
  }
  const stages = [...grouped].map(([name, value]) => ({ name, value }));
  const health = ["On track", "Watch", "At risk"].map((name) => ({
    name,
    value: data.projects.filter((p) => p.health === name).length,
  }));
  return (
    <section className="finance-dashboard">
      <div className="finance-heading">
        <div>
          <h2>Revenue & commercial outlook</h2>
          <p>
            Angka dari Sheets · expected revenue merupakan pipeline, bukan
            revenue terealisasi.
          </p>
        </div>
        {ids.length > 0 && (
          <label>
            Financial source
            <select value={sheet} onChange={(e) => setChosen(e.target.value)}>
              {ids.map((id) => (
                <option key={id} value={id}>
                  {data.sourceSheets?.find((s) => s.id === id)?.title ?? id}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="finance-metrics">
        <div>
          <small>Expected revenue · pipeline</small>
          <strong>
            {records.length > totals.revenueMissing
              ? money(totals.revenue)
              : "—"}
          </strong>
          <span>
            {records.length - totals.revenueMissing} valid records ·{" "}
            {totals.revenueMissing} unknown
          </span>
        </div>
        <div>
          <small>Profit · source basis</small>
          <strong>
            {records.length > totals.profitMissing ? money(totals.profit) : "—"}
          </strong>
          <span>{totals.profitMissing} missing / invalid</span>
        </div>
        <div>
          <small>Weighted margin · known pairs</small>
          <strong>
            {totals.margin === undefined
              ? "—"
              : `${(totals.margin * 100).toFixed(1)}%`}
          </strong>
          <span>{totals.marginRows} complete records</span>
        </div>
        <div>
          <small>Recognized revenue</small>
          <strong>—</strong>
          <span>Belum tersedia sebagai metrik terverifikasi.</span>
        </div>
      </div>
      <div className="performance-grid">
        <div className="executive-card finance-chart">
          <h2>Expected revenue by pipeline status</h2>
          {stages.length ? (
            <ResponsiveContainer width="100%" height={270}>
              <BarChart
                data={stages}
                margin={{ top: 20, right: 20, bottom: 30, left: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tickFormatter={money} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Bar
                  dataKey="value"
                  name="Expected revenue"
                  fill="#228877"
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="finance-empty">
              Belum ada nilai expected revenue yang valid dari sumber ini. Sync
              Sheets untuk memperbarui.
            </p>
          )}
        </div>
        <div className="executive-card finance-chart">
          <h2>Project health · real workspace</h2>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart
              data={health}
              margin={{ top: 20, right: 20, bottom: 30, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 13 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar
                dataKey="value"
                name="Projects"
                fill="#497df4"
                radius={[5, 5, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
