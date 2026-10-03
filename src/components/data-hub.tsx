"use client";
import { BusinessRecords } from "./business-records";
import { readExcelFiles } from "@/services/excel-import";
import { prepareBusinessSheets } from "@/services/business-import";
import { BusinessSheetImport } from "./google/sheet-import";
import { useEffect, useState } from "react";
import { Upload, Download, ArrowUpRight } from "lucide-react";
import { Workspace, Meeting } from "@/domain/models";
import {
  prepareWorkspaceImport,
  downloadWorkspace,
  emptyWorkspace,
} from "@/services/import-workspace";
import { Badge, Modal, Empty } from "./ui";
import { getSupabase } from "@/lib/supabase";
import { isWorkspace } from "@/services/validation";
interface Proposal {
  id: string;
  title: string;
  payload: Workspace;
  created_at: string;
}
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  if (!data.session) throw new Error("Silakan login kembali.");
  const result = await fetch(`/api/gpt/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await result.json();
  if (!result.ok)
    throw new Error(payload.error ?? "Koneksi GPT belum tersedia.");
  return payload as T;
}
export function DataHub({
  data,
  cloud,
  save,
  refresh,
  expectedRevision,
}: {
  data: Workspace;
  cloud: boolean;
  save: (data: Workspace, message: string) => Promise<boolean>;
  refresh: () => void;
  expectedRevision?: () => number | undefined;
}) {
  const [text, setText] = useState("");
  const [source, setSource] = useState("GPT project export");
  const [prepared, setPrepared] = useState<Workspace>();
  const [error, setError] = useState("");
  const [backedUp, setBackedUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clear, setClear] = useState(false);
  const [plaud, setPlaud] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [project, setProject] = useState("");
  const [meetingDate, setMeetingDate] = useState(
    new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16),
  );
  const [participants, setParticipants] = useState("");
  const [key, setKey] = useState("");
  const [keyNotice, setKeyNotice] = useState("");
  const [keyConfirm, setKeyConfirm] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selected, setSelected] = useState<Proposal>();
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    api<{ proposals: Proposal[] }>("proposals")
      .then((r) => {
        if (active) setProposals(r.proposals);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [cloud]);
  async function file(
    event: React.ChangeEvent<HTMLInputElement>,
    kind: "projects" | "plaud",
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1000000) {
      setError("File maksimal 1 MB.");
      return;
    }
    try {
      const content = await file.text();
      if (kind === "projects") {
        setText(content);
        setSource(file.name);
      } else {
        setPlaud(content);
        setMeetingTitle(file.name.replace(/\.[^.]+$/, ""));
      }
      setError("");
    } catch {
      setError("File tidak bisa dibaca.");
    }
    event.target.value = "";
  }
  function review() {
    try {
      setPrepared(prepareWorkspaceImport(text, source));
      setBackedUp(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import tidak valid.");
    }
  }
  async function applyImport() {
    if (!prepared || !backedUp || busy) return;
    setBusy(true);
    const ok = await save(prepared, "Workspace asli berhasil diimpor");
    if (ok) {
      setPrepared(undefined);
      setText("");
    }
    setBusy(false);
  }
  async function importMeeting() {
    const linked = data.projects.find((p) => p.id === project);
    if (!linked || !meetingTitle.trim() || !plaud.trim() || !meetingDate) {
      setError("Isi judul, tanggal, proyek, dan ringkasan meeting.");
      return;
    }
    setBusy(true);
    const meeting: Meeting = {
      id: crypto.randomUUID(),
      title: meetingTitle.trim(),
      participants: participants
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      date: meetingDate + ":00+07:00",
      source: "Plaud import",
      summary: plaud.trim(),
      decisions: [],
      commitments: [],
      actions: [],
      risks: [],
      followUps: [],
      project: linked.id,
    };
    const ok = await save(
      {
        ...data,
        meetings: [...data.meetings, meeting],
        projects: data.projects.map((p) =>
          p.id === linked.id
            ? { ...p, meetings: [...p.meetings, meeting.id] }
            : p,
        ),
      },
      "Ringkasan Plaud tersimpan",
    );
    if (ok) {
      setPlaud("");
      setMeetingTitle("");
    }
    setBusy(false);
  }
  async function generateKey() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ key: string; expiresAt: string }>(
        "key",
        "POST",
      );
      setKey(result.key);
      setKeyNotice(
        `Berlaku sampai ${new Date(result.expiresAt).toLocaleDateString("id-ID")}. Key lama otomatis dicabut. Simpan key ini di konfigurasi Action Custom GPT; jangan kirim di chat.`,
      );
      setKeyConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Key belum tersedia.");
    } finally {
      setBusy(false);
    }
  }
  async function applyProposal() {
    if (!selected || !backedUp || busy) return;
    setBusy(true);
    try {
      const revision = expectedRevision?.();
      if (revision === undefined)
        throw new Error("Reload workspace sebelum menerapkan proposal.");
      await api("proposals", "PATCH", {
        id: selected.id,
        action: "apply",
        expectedRevision: revision,
      });
      setSelected(undefined);
      setProposals((p) => p.filter((p) => p.id !== selected.id));
      refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Proposal belum dapat diterapkan.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="view-stack">
      {error && (
        <div className="access-error" role="alert">
          {error}
        </div>
      )}
      <BusinessRecords data={data} />
      <BusinessSheetImport
        review={(workspace) => {
          setPrepared(workspace);
          setBackedUp(false);
        }}
      />
      <section className="panel detail-card">
        <h2>Workspace asli DDS & DDO</h2>
        <label className="secondary-button upload-label">
          {busy
            ? "Reading Excel…"
            : "Choose DDO / DDS Excel files (select all 3)"}
          <input
            type="file"
            accept=".xlsx"
            multiple
            disabled={busy}
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              if (!files.length) return;
              setBusy(true);
              setError("");
              try {
                const sheets = await readExcelFiles(files);
                const imported = prepareBusinessSheets(sheets);
                if (!imported.sourceRecords?.length)
                  throw new Error("Tidak ada tabel DDO/DDS yang dikenali.");
                setPrepared(imported);
                setBackedUp(false);
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Excel tidak dapat dibaca",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        <p>
          Impor JSON dari GPT atau backup OS. Data ditampilkan untuk review
          sebelum menggantikan seluruh workspace; tidak digabung otomatis dengan
          data contoh.
        </p>
        <div className="account-actions">
          <button
            className="secondary-button"
            onClick={() => downloadWorkspace(data)}
          >
            <Download size={14} />
            Export workspace for GPT / backup
          </button>
          <label className="secondary-button upload-label">
            <Upload size={14} />
            Choose JSON file
            <input
              type="file"
              accept=".json,.txt"
              onChange={(e) => file(e, "projects")}
            />
          </label>
        </div>
        <label className="field-label">
          Source name
          <input value={source} onChange={(e) => setSource(e.target.value)} />
        </label>
        <label className="field-label">
          Paste project JSON
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000000}
            placeholder={
              '{"projects":[{"name":"Nama proyek asli","company":"DDO","owner":"Nama PIC asli","latestUpdate":"Update dari sumber","nextAction":"Langkah berikutnya"}]}'
            }
          />
        </label>
        <button
          className="primary-button"
          onClick={review}
          disabled={!text.trim() || busy}
        >
          Review import
          <ArrowUpRight size={15} />
        </button>
        <p>
          Minimal tiap proyek: name, company (DDS/DDO/Shared), dan owner. Untuk
          mengimpor keputusan, tindakan, dan komitmen, gunakan JSON workspace
          lengkap hasil export. Jika info belum tersedia, biarkan kosong; jangan
          mengarang data.
        </p>
        <button
          className="text-button clear-workspace"
          onClick={() => {
            setClear(true);
            setBackedUp(false);
          }}
        >
          Clear workspace and keep company structure
        </button>
      </section>
      <section className="panel detail-card">
        <h2>Plaud meeting intelligence</h2>
        <p>
          Upload atau tempel ringkasan Plaud. Impor menyimpan sumber meeting
          secara utuh; keputusan/komitmen belum diekstrak otomatis. Sinkronisasi
          akun Plaud otomatis belum terhubung.
        </p>
        <label className="secondary-button upload-label">
          <Upload size={14} />
          Upload Plaud text
          <input
            type="file"
            accept=".txt,.md"
            onChange={(e) => file(e, "plaud")}
          />
        </label>
        <div className="import-fields">
          <label className="field-label">
            Meeting title
            <input
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
            />
          </label>
          <label className="field-label">
            Date & time (WIB)
            <input
              type="datetime-local"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </label>
          <label className="field-label">
            Project
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">Choose project</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Participants (comma separated)
            <input
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
            />
          </label>
        </div>
        <label className="field-label">
          Summary
          <textarea
            value={plaud}
            onChange={(e) => setPlaud(e.target.value)}
            maxLength={1000000}
          />
        </label>
        <button
          className="primary-button"
          onClick={importMeeting}
          disabled={busy || !plaud.trim()}
        >
          Save meeting summary
        </button>
      </section>
      <section className="panel detail-card">
        <h2>GPT ↔ KIMO OS</h2>
        <p>
          Custom GPT dapat membaca workspace dan mengirim proposal. Perubahan
          hanya diterapkan setelah kamu review di OS. Chat GPT lainnya tidak
          otomatis dibaca.
        </p>
        <Badge>{cloud ? "Cloud account" : "Login required"}</Badge>
        <div className="account-actions">
          <button
            className="secondary-button"
            disabled={!cloud || busy}
            onClick={() => setKeyConfirm(true)}
          >
            Create / replace GPT connection key
          </button>
          <button
            className="secondary-button"
            disabled={!cloud || busy}
            onClick={async () => {
              try {
                await api("key", "DELETE");
                setKey("");
                setKeyNotice(
                  "Key dicabut. Custom GPT tidak dapat mengakses OS.",
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Revoke failed.");
              }
            }}
          >
            Revoke GPT access
          </button>
          <a
            className="secondary-button"
            href="/api/gpt/schema"
            target="_blank"
            rel="noreferrer"
          >
            Action schema
          </a>
        </div>
        {key && (
          <label className="field-label">
            Connection key — shown only here
            <input readOnly value={key} />
          </label>
        )}
        {keyNotice && <p role="status">{keyNotice}</p>}
        <h3>Proposals waiting for review</h3>
        {proposals.map((p) => (
          <button
            className="detail-link"
            key={p.id}
            onClick={() => {
              if (!isWorkspace(p.payload)) {
                setError("Proposal tidak valid.");
                return;
              }
              setSelected(p);
              setBackedUp(false);
            }}
          >
            {p.title}
            <Badge>Review</Badge>
          </button>
        ))}
        {!proposals.length && (
          <Empty text="Belum ada proposal GPT. Jalankan migrasi dan setup Custom GPT untuk menghubungkan akun." />
        )}
      </section>
      {(prepared || selected || clear) && (
        <Modal
          title={
            clear
              ? "Clear saved workspace?"
              : selected
                ? "Review GPT proposal"
                : "Review workspace replacement"
          }
          onClose={() => {
            setPrepared(undefined);
            setSelected(undefined);
            setClear(false);
          }}
        >
          <p>
            Workspace saat ini: {data.projects.length} proyek,{" "}
            {data.decisions.length} keputusan, {data.commitments.length}{" "}
            komitmen.
          </p>
          <p>
            Workspace baru:{" "}
            {
              (prepared ?? selected?.payload ?? emptyWorkspace()).projects
                .length
            }{" "}
            proyek,{" "}
            {
              (prepared ?? selected?.payload ?? emptyWorkspace()).decisions
                .length
            }{" "}
            keputusan,{" "}
            {
              (prepared ?? selected?.payload ?? emptyWorkspace()).commitments
                .length
            }{" "}
            komitmen. Seluruh data workspace akan diganti. Koneksi Google tidak
            ikut dihapus.
          </p>
          {(prepared ?? selected?.payload)?.projects.map((p) => (
            <div className="connection-row" key={p.id}>
              <strong>{p.name}</strong>
              <span>
                {p.company === "studio"
                  ? "DDS"
                  : p.company === "originals"
                    ? "DDO"
                    : "Shared"}{" "}
                · {p.owner}
              </span>
            </div>
          ))}
          <p>
            Task: {(prepared ?? selected?.payload)?.actions.length ?? 0} · Lead:{" "}
            {(prepared ?? selected?.payload)?.sourceRecords?.filter(
              (r) => r.kind === "lead",
            ).length ?? 0}{" "}
            · Commercial:{" "}
            {(prepared ?? selected?.payload)?.sourceRecords?.filter(
              (r) => r.kind === "commercial",
            ).length ?? 0}{" "}
            · Source tabs:{" "}
            {(prepared ?? selected?.payload)?.sourceSheets?.length ?? 0}
          </p>
          <div className="account-actions">
            <button
              className="secondary-button"
              onClick={() => {
                downloadWorkspace(data);
                setBackedUp(true);
              }}
            >
              Download current backup first
            </button>
            <button
              className="primary-button"
              disabled={!backedUp || busy}
              onClick={
                clear
                  ? async () => {
                      setBusy(true);
                      if (await save(emptyWorkspace(), "Workspace dikosongkan"))
                        setClear(false);
                      setBusy(false);
                    }
                  : selected
                    ? applyProposal
                    : applyImport
              }
            >
              {busy ? "Saving…" : "Confirm replacement"}
            </button>
            {selected && (
              <button
                className="secondary-button"
                onClick={async () => {
                  try {
                    await api("proposals", "PATCH", {
                      id: selected.id,
                      action: "reject",
                    });
                    setProposals((p) => p.filter((p) => p.id !== selected.id));
                    setSelected(undefined);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Reject failed.");
                  }
                }}
              >
                Reject proposal
              </button>
            )}
          </div>
        </Modal>
      )}
      {keyConfirm && (
        <Modal
          title="Create GPT connection key?"
          onClose={() => setKeyConfirm(false)}
        >
          <p>
            Custom GPT yang memiliki key ini dapat membaca seluruh workspace
            tersimpan dan mengirim proposal selama 90 hari. Key lama dicabut
            saat key baru dibuat.
          </p>
          <button
            className="primary-button"
            disabled={busy}
            onClick={generateKey}
          >
            Create connection key
          </button>
        </Modal>
      )}
    </div>
  );
}
