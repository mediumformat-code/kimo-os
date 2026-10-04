"use client";
import { useState } from "react";
import type { Workspace } from "@/domain/models";
import {
  parsePlaudRecording,
  reviewPlaudDraft,
  type PlaudSource,
  type PlaudDraft,
} from "@/services/plaud";
import { getSupabase } from "@/lib/supabase";
import { Modal } from "../ui";
export function PlaudSources({
  data,
  cloud,
  refresh,
  save,
}: {
  data: Workspace;
  cloud: boolean;
  refresh: () => void;
  save: (data: Workspace, message: string) => Promise<boolean>;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<{
    source: PlaudSource;
    draft: PlaudDraft;
  }>();
  const [project, setProject] = useState("");
  const [owner, setOwner] = useState("");
  const [deadline, setDeadline] = useState("");
  async function sync() {
    setBusy(true);
    setMessage("");
    try {
      const recording = parsePlaudRecording(JSON.parse(input));
      const { data: session } = await getSupabase().auth.getSession();
      if (!session.session) throw new Error("Login diperlukan.");
      const response = await fetch("/api/plaud/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(recording),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Sync gagal. Retry dengan ID yang sama.",
        );
      setMessage(
        result.status === "duplicate"
          ? "ID Plaud sudah tersimpan; tidak diduplikasi."
          : "Rekaman tersimpan. Draft menunggu review.",
      );
      setInput("");
      refresh();
    } catch (e) {
      setMessage(
        e instanceof SyntaxError
          ? "JSON rekaman tidak valid."
          : e instanceof Error
            ? e.message
            : "Sync gagal.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function review(action: "apply" | "reject") {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      const next = reviewPlaudDraft(
        data,
        selected.source.id,
        selected.draft.id,
        { action, projectId: project, owner, deadline },
      );
      if (
        await save(
          next,
          action === "apply"
            ? "Draft Plaud diterapkan setelah review"
            : "Draft Plaud ditolak",
        )
      )
        setSelected(undefined);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Review gagal.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel detail-card">
      <h2>Plaud sync & review</h2>
      <p>
        Ringkasan dari koneksi resmi Plaud. Action dan keputusan tetap draft
        sampai direview. ID Plaud mencegah duplikasi; gagal sync dapat dikirim
        ulang.
      </p>
      {data.plaudSync && (
        <p>
          Sync terakhir berhasil: {data.plaudSync.lastSuccessAt ?? "Belum ada"}{" "}
          · Percobaan terakhir: {data.plaudSync.lastAttemptAt} ·{" "}
          {data.plaudSync.status} ({data.plaudSync.attempts} percobaan). Waktu
          sync dalam UTC.
        </p>
      )}
      {data.plaudSync?.error && <p role="alert">{data.plaudSync.error}</p>}
      {message && <p role="status">{message}</p>}
      {(["studio", "originals", "hipmi", "unassigned"] as const).map(
        (scope) => (
          <div key={scope}>
            <h3>
              {
                {
                  studio: "DD Studio",
                  originals: "DD Originals",
                  hipmi: "HIPMI — terpisah",
                  unassigned: "Belum diklasifikasikan",
                }[scope]
              }
            </h3>
            {(data.plaudSources ?? [])
              .filter((s) => s.scope === scope)
              .map((s) => (
                <article className="detail-card" key={s.id}>
                  <strong>{s.title}</strong>
                  <p>
                    {s.recordedAt} ·{" "}
                    {s.timezone ?? "Zona waktu sumber tidak tersedia"}
                  </p>
                  <a href={s.sourceUrl} target="_blank" rel="noreferrer">
                    Buka sumber Plaud
                  </a>
                  <p>ID: {s.id}</p>
                  {new URL(s.sourceUrl).pathname === "/" && (
                    <small>
                      Tautan membuka akun Plaud; cari judul atau ID ini. Tautan
                      langsung rekaman belum tersedia.
                    </small>
                  )}
                  <p>{s.relevanceEvidence}</p>
                  <details>
                    <summary>Ringkasan</summary>
                    <p style={{ whiteSpace: "pre-wrap" }}>{s.summary}</p>
                  </details>
                  {s.drafts.map((d) => (
                    <div className="connection-row" key={d.id}>
                      <span>
                        {d.kind === "action" ? "Action" : "Keputusan"}: {d.text}{" "}
                        · {d.status}
                      </span>
                      {d.status === "Review" && (
                        <button
                          className="secondary-button"
                          onClick={() => {
                            setSelected({ source: s, draft: d });
                            setProject(s.projectId ?? "");
                            setOwner("");
                            setDeadline("");
                          }}
                        >
                          Review draft
                        </button>
                      )}
                    </div>
                  ))}
                </article>
              ))}
          </div>
        ),
      )}
      <details>
        <summary>Sync satu rekaman / retry</summary>
        <p>
          Tempel JSON rekaman yang diambil melalui Plaud MCP resmi. Maksimal
          satu rekaman per request. Jangan tempel token atau URL audio bertoken.
        </p>
        <label className="field-label">
          JSON rekaman
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={400000}
          />
        </label>
        <button
          className="primary-button"
          disabled={!cloud || busy || !input.trim()}
          onClick={sync}
        >
          Sync satu rekaman
        </button>
      </details>
      {selected && (
        <Modal
          title="Review draft Plaud"
          onClose={() => setSelected(undefined)}
        >
          <p>{selected.draft.text}</p>
          <h3>Bukti sumber</h3>
          <p>{selected.draft.evidence}</p>
          <p>PIC dan deadline boleh kosong jika belum dikonfirmasi.</p>
          <label className="field-label">
            Proyek
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">Pilih proyek yang relevan</option>
              {data.projects
                .filter((p) => p.company === selected.source.scope)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field-label">
            PIC terkonfirmasi
            <input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </label>
          <label className="field-label">
            Deadline terkonfirmasi
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <button
            className="primary-button"
            disabled={
              busy ||
              !project ||
              !["studio", "originals"].includes(selected.source.scope)
            }
            onClick={() => review("apply")}
          >
            Terapkan draft
          </button>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => review("reject")}
          >
            Tolak draft
          </button>
        </Modal>
      )}
    </section>
  );
}
