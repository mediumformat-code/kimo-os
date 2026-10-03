"use client";
import { useState } from "react";
import type { Workspace } from "@/domain/models";
export function BusinessRecords({ data }: { data: Workspace }) {
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const records = (data.sourceRecords ?? []).filter(
    (r) =>
      (kind === "all" || r.kind === kind) &&
      Object.values(r.fields)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  if (!data.sourceSheets?.length) return null;
  return (
    <section className="panel detail-card">
      <h2>Imported business records</h2>
      <p>
        {data.sourceSheets.length} tab sumber tersimpan. Status, nilai keuangan,
        kontak, tautan dan catatan asli dipertahankan. Tab salinan, ringkasan
        dan kalender tersimpan sebagai arsip; tidak dijadikan proyek tambahan.
        Nilai error formula bukan angka nol.
      </p>
      <div className="import-fields">
        <label className="field-label">
          Record type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">All</option>
            <option value="project">DDS projects</option>
            <option value="task">DDO tasks</option>
            <option value="lead">DDS leads / contacts</option>
            <option value="commercial">DDS commercial</option>
          </select>
        </label>
        <label className="field-label">
          Search records
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      <p>
        {records.length} records · nilai komersial dari tab berbeda tidak
        dijumlah otomatis.
      </p>
      {records.slice(0, 100).map((r) => (
        <details key={r.id}>
          <summary>
            {r.kind} ·{" "}
            {Object.entries(r.fields).find(([k]) =>
              /task title|project name|\. Company$/i.test(k),
            )?.[1] || r.id}
          </summary>
          <p>
            {data.sourceSheets?.find((s) => s.id === r.sheet)?.title} · row{" "}
            {r.row}
          </p>
          <dl>
            {Object.entries(r.fields).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd
                  style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
      {records.length > 100 && (
        <p>Showing first 100 results. Use search to narrow results.</p>
      )}
    </section>
  );
}
