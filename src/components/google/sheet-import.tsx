"use client";
import { useState } from "react";
import { Workspace } from "@/domain/models";
import { businessSources } from "@/integrations/google/sources";
import { googleService } from "@/services/google";
import {
  prepareWorkspaceImport,
  mergeProjectSources,
} from "@/services/import-workspace";
import { useGoogle } from "./provider";
import { Badge } from "../ui";
export function BusinessSheetImport({
  review,
}: {
  review: (workspace: Workspace) => void;
}) {
  const google = useGoogle();
  const [staged, setStaged] = useState<Record<string, Workspace>>({});
  const [source, setSource] = useState(0);
  const [rows, setRows] = useState<string[][]>([]);
  const [header, setHeader] = useState(0);
  const [nameColumn, setNameColumn] = useState("");
  const [ownerColumn, setOwnerColumn] = useState("");
  const [updateColumn, setUpdateColumn] = useState("");
  const [actionColumn, setActionColumn] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState("");
  const item = businessSources[source];
  async function read() {
    setBusy(true);
    setError("");
    setProblems("");
    try {
      const result = await googleService.document(item.id, item.gid, true);
      setRows(result.rows ?? []);
      setHeader(0);
      setNameColumn("");
      setOwnerColumn("");
      setUpdateColumn("");
      setActionColumn("");
      if (!result.rows?.length)
        setError("Tidak ada nilai pada 500 baris pertama tab sumber.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sumber belum bisa dibaca.");
    } finally {
      setBusy(false);
    }
  }
  function prepare() {
    try {
      if (!nameColumn || !ownerColumn)
        throw new Error("Pilih kolom nama proyek dan owner sebelum review.");
      const projects = rows
        .slice(header + 1)
        .filter((r) => r[Number(nameColumn)]?.trim())
        .map((r, index) => ({
          id: `sheet-${item.id}-${header + index + 2}`,
          name: r[Number(nameColumn)].trim(),
          company: item.company,
          owner: r[Number(ownerColumn)]?.trim() ?? "",
          latestUpdate: updateColumn ? (r[Number(updateColumn)] ?? "") : "",
          nextAction: actionColumn ? (r[Number(actionColumn)] ?? "") : "",
        }));
      const missing = projects.filter((p) => !p.owner);
      if (missing.length) {
        setProblems(
          `${missing.length} baris memiliki nama proyek tanpa owner. Lengkapi owner di sumber atau gunakan impor JSON dengan owner yang sudah dikonfirmasi.`,
        );
        return;
      }
      setProblems("");
      const prepared = prepareWorkspaceImport(
        JSON.stringify({ projects }),
        item.name,
      );
      prepared.projects = prepared.projects.map((p) => ({
        ...p,
        documents: [item.url],
      }));
      setStaged((s) => ({ ...s, [item.id]: prepared }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mapping tidak valid.");
    }
  }
  const columns = rows[header] ?? [];
  const column = (value: string, set: (v: string) => void, label: string) => (
    <label className="field-label">
      {label}
      <select value={value} onChange={(e) => set(e.target.value)}>
        <option value="">Choose column</option>
        {columns.map((c, i) => (
          <option value={String(i)} key={i}>
            {i + 1}. {c || "(Empty header)"}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="panel detail-card">
      <h2>DDO / DDS source sheets</h2>
      <p>
        Tiga spreadsheet yang kamu berikan sudah tercatat. Akun Google yang
        terhubung harus memiliki akses ke file. Preview membaca tab yang
        spesifik; mapping kolom direview sebelum mengganti workspace.
      </p>
      {businessSources.map((s, i) => (
        <div className="connection-row" key={s.id}>
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.name}
          </a>
          <Badge>{s.company}</Badge>
          <button
            className="text-button"
            onClick={() => {
              setSource(i);
              setRows([]);
            }}
          >
            {source === i ? "Selected" : "Select"}
          </button>
        </div>
      ))}
      <div className="account-actions">
        <button
          className="primary-button"
          disabled={!google?.status?.connected || busy}
          onClick={read}
        >
          {busy ? "Reading source…" : `Read ${item.name}`}
        </button>
      </div>
      {!google?.status?.connected && (
        <p>Hubungkan Google Workspace di Settings sebelum membaca sumber.</p>
      )}
      {error && (
        <div className="access-error" role="alert">
          {error}
        </div>
      )}
      {rows.length > 0 && (
        <>
          <p>
            {rows.length} baris terbaca (maksimal 500 × 52 kolom). Pilih baris
            header; health memakai Watch dan priority 50 bila belum tersedia.
            Mapping satu sumber menggantikan workspace; gabungkan DDS/DDO lewat
            JSON bila ingin impor sekaligus.
          </p>
          <label className="field-label">
            Header row
            <select
              value={header}
              onChange={(e) => {
                setHeader(Number(e.target.value));
                setNameColumn("");
                setOwnerColumn("");
              }}
            >
              {rows.slice(0, 20).map((r, i) => (
                <option key={i} value={i}>
                  Row {i + 1}: {r.join(" · ").slice(0, 100)}
                </option>
              ))}
            </select>
          </label>
          <div className="import-fields">
            {column(nameColumn, setNameColumn, "Project name (required)")}
            {column(ownerColumn, setOwnerColumn, "Owner (required)")}
            {column(updateColumn, setUpdateColumn, "Latest update (optional)")}
            {column(actionColumn, setActionColumn, "Next action (optional)")}
          </div>
          <div className="google-table-wrap">
            <table className="google-table">
              <tbody>
                {rows.slice(header, header + 6).map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {problems && (
            <div className="access-error" role="alert">
              {problems}
            </div>
          )}
          <button className="secondary-button" onClick={prepare}>
            Add source to staged import
          </button>
        </>
      )}
      {Object.keys(staged).length > 0 && (
        <div className="staged-sources">
          <h3>Staged sources ({Object.keys(staged).length})</h3>
          {Object.values(staged).map((s) => (
            <p key={s.metadata?.sourceName}>
              {s.metadata?.sourceName} · {s.projects.length} projects
            </p>
          ))}
          <button
            className="primary-button"
            onClick={() => {
              try {
                review(mergeProjectSources(Object.values(staged)));
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Sumber tidak konsisten.",
                );
              }
            }}
          >
            Review combined source import
          </button>
        </div>
      )}
    </section>
  );
}
