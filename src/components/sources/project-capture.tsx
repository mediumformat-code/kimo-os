"use client";
import { useState } from "react";
import type { Workspace } from "@/domain/models";
import { appendCapture, captureText } from "@/presentation/capture";
import { executiveWorkspace } from "@/presentation/hierarchy";

export function ProjectCapture({
  data,
  save,
}: {
  data: Workspace;
  save: (data: Workspace, message: string) => Promise<boolean>;
}) {
  const kind = "GPT Projects" as const;
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [projectId, setProject] = useState("");
  const [company, setCompany] = useState<"studio" | "originals">("originals");
  const [text, setText] = useState("");
  const [actions, setActions] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const projects = executiveWorkspace(data).projects;
  function change() {
    setPreview("");
    setError("");
  }
  async function apply() {
    setBusy(true);
    setError("");
    try {
      const next = appendCapture(data, {
        kind,
        title,
        owner,
        company,
        projectId: projectId || undefined,
        text,
        date: `${date}T12:00:00+07:00`,
        actions: actions.split("\n"),
      });
      if (await save(next, `${kind} source tersimpan`)) {
        setText("");
        setActions("");
        setPreview("");
        setTitle("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import gagal.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel detail-card capture-panel">
      <div className="capture-heading">
        <div>
          <span className="eyebrow">PROJECT KNOWLEDGE & MEETING CAPTURE</span>
          <h2>GPT Projects — manual capture</h2>
        </div>
        <span className="badge">Import ready · account sync not connected</span>
      </div>
      <p>
        Masukkan percakapan proyek dari GPT. Pilih proyek, review teks dan
        action, lalu simpan ke Meetings dan Priorities. Data Sheets tetap
        tersimpan.
      </p>
      <p className="capture-note">
        Private ChatGPT Projects belum bisa ditarik otomatis dari chat ini.
        Export percakapan atau gunakan rangkuman TXT/MD. Rekaman Plaud memakai
        alur sync dan draft review di atas.
      </p>
      {error && (
        <div role="alert" className="access-error">
          {error}
        </div>
      )}
      <div className="capture-grid">
        <label>
          Source
          <select value={kind} disabled>
            <option>GPT Projects</option>
          </select>
        </label>
        <label>
          Meeting / project title
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              change();
            }}
          />
        </label>
        <label>
          Link to project
          <select
            value={projectId}
            onChange={(e) => {
              setProject(e.target.value);
              change();
            }}
          >
            <option value="">Create a new project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Owner
          <input
            value={owner}
            onChange={(e) => {
              setOwner(e.target.value);
              change();
            }}
          />
        </label>
        {!projectId && (
          <label>
            Company
            <select
              value={company}
              onChange={(e) => {
                setCompany(e.target.value as typeof company);
                change();
              }}
            >
              <option value="studio">Double Deer Studio</option>
              <option value="originals">Double Deer Originals</option>
            </select>
          </label>
        )}
        <label>
          Source date
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              change();
            }}
          />
        </label>
      </div>
      <label>
        Upload transcript / ChatGPT export
        <input
          type="file"
          accept=".txt,.md,.json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (file.size > 10_000_000) {
              setError("File maksimal 10 MB.");
              return;
            }
            try {
              setText(await file.text());
              if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
              change();
            } catch {
              setError("File tidak bisa dibaca.");
            }
          }}
        />
      </label>
      <label>
        Transcript / source text
        <textarea
          rows={6}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            change();
          }}
          placeholder="Paste Plaud transcript or GPT project summary…"
        />
      </label>
      <label>
        Reviewed next actions — one per line
        <textarea
          rows={3}
          value={actions}
          onChange={(e) => {
            setActions(e.target.value);
            change();
          }}
          placeholder="Only add actions you have confirmed. Deadlines can be set in Priorities."
        />
      </label>
      <button
        onClick={() => {
          try {
            if (!title.trim() || !owner.trim() || !date)
              throw new Error("Isi judul, owner, dan tanggal.");
            setPreview(captureText(text));
            setError("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Preview gagal.");
          }
        }}
      >
        Review source
      </button>
      {preview && (
        <div className="capture-preview">
          <h3>Review before adding</h3>
          <p>
            {projectId
              ? "Attach to existing project"
              : `Create ${title} · ${company === "studio" ? "Double Deer Studio" : "Double Deer Originals"}`}{" "}
            · Owner: {owner}
          </p>
          <pre>{preview}</pre>
          <p>
            {actions.split("\n").filter((a) => a.trim()).length} reviewed
            actions · source text preserved.
          </p>
          <button className="primary" disabled={busy} onClick={apply}>
            {busy ? "Saving…" : "Add reviewed source to KIMO OS"}
          </button>
        </div>
      )}
    </section>
  );
}
