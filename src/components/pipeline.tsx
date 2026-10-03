"use client";
import { useState } from "react";
import type { Workspace, CompanyId } from "@/domain/models";
import {
  sourceField,
  sourceMoney,
  commercialTotals,
} from "@/services/business-views";
import { Badge, Empty } from "./ui";
const money = (value: number | undefined) =>
  value === undefined
    ? "Unavailable"
    : new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(value);
export function Pipeline({
  data,
  company,
}: {
  data: Workspace;
  company?: CompanyId;
}) {
  const [kind, setKind] = useState("commercial");
  const [sheet, setSheet] = useState("");
  const [status, setStatus] = useState("");
  const [owner, setOwner] = useState("");
  const [query, setQuery] = useState("");
  const all = (data.sourceRecords ?? []).filter((r) => r.kind === kind);
  const sourceIds = [...new Set(all.map((r) => r.sheet))];
  const selected = sourceIds.includes(sheet) ? sheet : sourceIds[0];
  const sourced = all.filter((r) => r.sheet === selected);
  const records = (company === "originals" ? [] : sourced).filter(
    (r) =>
      (!status || sourceField(r, "Status") === status) &&
      (!owner || sourceField(r, "Account", "Commercial PIC") === owner) &&
      Object.values(r.fields)
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const totals = commercialTotals(records);
  return (
    <div className="view-stack">
      <section className="panel detail-card">
        <h2>DDS commercial pipeline</h2>
        <div className="tabs">
          <button
            className={kind === "commercial" ? "active" : ""}
            onClick={() => {
              setKind("commercial");
              setSheet("");
              setStatus("");
              setOwner("");
            }}
          >
            Commercial
          </button>
          <button
            className={kind === "lead" ? "active" : ""}
            onClick={() => {
              setKind("lead");
              setSheet("");
              setStatus("");
              setOwner("");
            }}
          >
            Leads & contacts
          </button>
        </div>
        <div className="business-filters">
          <label className="field-label">
            Pipeline source
            <select
              aria-label="Pipeline source"
              value={selected ?? ""}
              onChange={(e) => {
                setSheet(e.target.value);
                setStatus("");
                setOwner("");
              }}
            >
              {sourceIds.map((id) => (
                <option key={id} value={id}>
                  {data.sourceSheets?.find((s) => s.id === id)?.file} ·{" "}
                  {data.sourceSheets?.find((s) => s.id === id)?.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Search pipeline
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Client, project, contact"
            />
          </label>
          <label className="field-label">
            Pipeline status
            <select
              aria-label="Pipeline status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {[
                ...new Set(
                  sourced.map((r) => sourceField(r, "Status")).filter(Boolean),
                ),
              ]
                .sort()
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </select>
          </label>
          <label className="field-label">
            Commercial PIC
            <select
              aria-label="Commercial PIC"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">All PICs</option>
              {[
                ...new Set(
                  sourced
                    .map((r) => sourceField(r, "Account", "Commercial PIC"))
                    .filter(Boolean),
                ),
              ]
                .sort()
                .map((o) => (
                  <option key={o}>{o}</option>
                ))}
            </select>
          </label>
        </div>
        <p>
          {records.length} records · satu sumber dipilih agar tab duplikat tidak
          dijumlah.
        </p>
        {kind === "commercial" && (
          <>
            <div className="business-metrics">
              <div>
                <small>Expected revenue · source basis</small>
                <strong>
                  {money(
                    records.length > totals.revenueMissing
                      ? totals.revenue
                      : undefined,
                  )}
                </strong>
                <small>{totals.revenueMissing} missing / invalid</small>
              </div>
              <div>
                <small>Profit · source basis</small>
                <strong>
                  {money(
                    records.length > totals.profitMissing
                      ? totals.profit
                      : undefined,
                  )}
                </strong>
                <small>{totals.profitMissing} missing / invalid</small>
              </div>
              <div>
                <small>
                  Weighted margin · {totals.marginRows} complete rows
                </small>
                <strong>
                  {totals.margin === undefined
                    ? "Unavailable"
                    : `${(totals.margin * 100).toFixed(1)}%`}
                </strong>
              </div>
            </div>
            <p>
              Angka mengikuti filter dan definisi sheet, bukan cash received.
              Nilai kosong/error tidak dianggap nol; margin hanya memakai
              pasangan revenue dan profit yang lengkap.
            </p>
          </>
        )}
      </section>
      <section className="panel detail-card">
        {records.length === 0 ? (
          <Empty text="No pipeline records. Import the DDS Excel files in Sources, or adjust your filters." />
        ) : (
          records.map((r) => (
            <details className="pipeline-record" key={r.id}>
              <summary>
                <span>
                  <strong>
                    {sourceField(
                      r,
                      kind === "lead" ? "Company" : "Project Name",
                    )}
                  </strong>
                  <small>
                    {sourceField(r, "Client", "Name")} ·{" "}
                    {sourceField(r, "Account", "Commercial PIC") ||
                      "PIC not provided"}
                  </small>
                </span>
                <Badge>{sourceField(r, "Status") || "No status"}</Badge>
                {kind === "commercial" && (
                  <span>
                    {money(sourceMoney(sourceField(r, "Expected Revenue")))}
                  </span>
                )}
              </summary>
              <p>Source row {r.row}</p>
              <dl className="source-fields">
                {Object.entries(r.fields).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replace(/^\d+\.\s*/, "")}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))
        )}
      </section>
    </div>
  );
}
