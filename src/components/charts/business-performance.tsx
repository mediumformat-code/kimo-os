"use client";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import {
  ChartNoAxesCombined,
  ChartPie,
  ArrowUpRight,
  ArrowLeft,
} from "lucide-react";
import type { CompanyId, Workspace } from "@/domain/models";
import { sampleRevenue } from "@/data/executive-metrics";
import { performance, money, type Timeframe } from "@/presentation/performance";
import { companies } from "@/presentation/hierarchy";
const colors = ["#242a30", "#497df4", "#9081df", "#c2c9d3", "#6f9990"];
export function BusinessPerformance({
  data,
  company,
  node,
  onScope,
  navigate,
}: {
  data: Workspace;
  company?: CompanyId;
  node?: string;
  onScope: (company?: CompanyId, node?: string) => void;
  navigate: (view: string) => void;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>("Year");
  const sample = data.metadata?.dataset !== "live";
  const report = performance(
    sample ? sampleRevenue : [],
    timeframe,
    company,
    node,
  );
  return (
    <div className="performance-grid">
      <section
        className="executive-card revenue-card"
        aria-label="Revenue and growth chart"
      >
        <div className="card-heading">
          <h2>
            <ChartNoAxesCombined size={17} />
            Revenue & growth
          </h2>
          <select
            aria-label="Revenue timeframe"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
          >
            {["Month", "Quarter", "Year"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="chart-controls">
          <select
            aria-label="Revenue company"
            value={company ?? "group"}
            onChange={(e) =>
              onScope(
                e.target.value === "group"
                  ? undefined
                  : (e.target.value as CompanyId),
              )
            }
          >
            <option value="group">Double Deer Group</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="chart-provenance">
            {sample ? "Illustrative data" : "Revenue not connected"}
          </span>
        </div>
        <div className="chart-headline">
          <strong>
            {report.total === undefined ? "—" : money(report.total)}
          </strong>
          {report.growth !== undefined && (
            <span className="positive">
              <ArrowUpRight size={15} />
              {report.growth.toFixed(1)}%
            </span>
          )}
          <small>
            {report.total === undefined
              ? "Verified revenue has not been reported"
              : `${report.period} · vs same period last year`}
          </small>
        </div>
        {report.points.length ? (
          <div className="revenue-plot">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart
                data={report.points}
                margin={{ top: 10, right: 8, left: -15, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#21876c" stopOpacity={0.25} />
                    <stop
                      offset="100%"
                      stopColor="#21876c"
                      stopOpacity={0.015}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef1f5" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#8a94a5" }}
                  minTickGap={15}
                />
                <YAxis
                  tickFormatter={(v) =>
                    new Intl.NumberFormat("en", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(v)
                  }
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#8a94a5" }}
                />
                <Tooltip
                  formatter={(v) => money(Number(v))}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #edf0f4",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="previous"
                  name="Previous year"
                  stroke="#c4ced9"
                  fill="#e7edf4"
                  fillOpacity={0.45}
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="current"
                  name="Revenue"
                  stroke="#198166"
                  fill="url(#revenue-fill)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="analytics-empty">
            <ChartNoAxesCombined size={26} />
            <strong>A clear picture starts with verified numbers.</strong>
            <p>
              Sheets pipeline values remain available separately. They are not
              recognized revenue.
            </p>
            <button onClick={() => navigate("Pipeline")}>
              View commercial pipeline <ArrowUpRight size={13} />
            </button>
          </div>
        )}
        <div className="chart-legend">
          <span>
            <i style={{ background: "#198166" }} />
            Revenue
          </span>
          <span>
            <i style={{ background: "#c4ced9" }} />
            Previous year
          </span>
        </div>
      </section>
      <section
        className="executive-card split-card"
        aria-label="Revenue by company chart"
      >
        <div className="card-heading">
          <h2>
            <ChartPie size={17} />
            Revenue by {company ? "business unit" : "company"}
          </h2>
          {(company || node) && (
            <button
              className="chart-back"
              onClick={() => (node ? onScope(company) : onScope())}
            >
              <ArrowLeft size={12} />
              {node ? "Company" : "Group"}
            </button>
          )}
        </div>
        <p className="chart-subtitle">
          {node
            ? node === "fam"
              ? "Frekuensi Antara Music"
              : node === "retail"
                ? "Retail"
                : node === "event-ip"
                  ? "Event IP"
                  : report.split[0]?.name
            : company
              ? companies.find((c) => c.id === company)?.name
              : "Two companies. One group perspective."}{" "}
          · {report.period}
        </p>
        {report.split.length ? (
          <div className="split-content">
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={report.split}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="69%"
                    outerRadius="95%"
                    paddingAngle={3}
                    stroke="none"
                    onClick={(_entry, index) => {
                      const selected = report.split[index];
                      if (!selected) return;
                      if (!company) onScope(selected.node as CompanyId);
                      else if (!node) onScope(company, selected.node);
                    }}
                  >
                    {report.split.map((r, i) => (
                      <Cell key={r.node} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => money(Number(v))}
                    contentStyle={{ borderRadius: 10, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-label">
                <strong>{money(report.total!)}</strong>
                <small>Revenue · IDR</small>
              </div>
            </div>
            <div className="split-legend">
              {report.split.map((r, i) => (
                <button
                  key={r.node}
                  disabled={!!node}
                  onClick={() =>
                    !company
                      ? onScope(r.node as CompanyId)
                      : onScope(company, r.node)
                  }
                >
                  <i style={{ background: colors[i % colors.length] }} />
                  <span>{r.name}</span>
                  <strong>
                    {((100 * r.value) / report.total!).toFixed(0)}%
                  </strong>
                  <small>{money(r.value)}</small>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="analytics-empty">
            <ChartPie size={26} />
            <strong>No verified company revenue yet.</strong>
            <p>
              Studio and Originals will appear here once comparable revenue is
              available.
            </p>
          </div>
        )}
        <p className="chart-footnote">
          {sample
            ? "Sample financials · click a segment to explore the hierarchy."
            : "Missing financials are kept unknown, never filled with sample values."}
        </p>
      </section>
    </div>
  );
}
