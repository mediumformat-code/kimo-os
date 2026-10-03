"use client";
import { GoogleSetup } from "./setup";
import { useState } from "react";
import {
  CalendarDays,
  Mail,
  FileText,
  RefreshCw,
  ArrowUpRight,
  Link2,
} from "lucide-react";
import { useGoogle } from "./provider";
import { Badge, Empty, Modal, SectionTitle } from "../ui";
import { googleService } from "@/services/google";
export function safeGoogleUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "google.com" || url.hostname.endsWith(".google.com"))
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
export function GoogleConnection({ navigate }: { navigate: () => void }) {
  const google = useGoogle();
  if (!google)
    return (
      <section className="panel detail-card">
        <h2>Google Workspace</h2>
        <p>Login ke cloud workspace untuk menghubungkan akun Google.</p>
      </section>
    );
  return (
    <section className="panel detail-card">
      <div className="card-top">
        <h2>Google Workspace</h2>
        <Badge tone={google.status?.connected ? "green" : ""}>
          {google.loading
            ? "Checking…"
            : google.status?.connected
              ? "Connected"
              : "Not connected"}
        </Badge>
      </div>
      <p>
        {google.status?.connected
          ? google.status.email
          : "Calendar, Gmail, Drive, Docs, dan Sheets dalam satu koneksi."}
      </p>
      <p>Akses baca. Tidak mengirim email atau mengubah file dan kalender.</p>
      {google.error && (
        <div className="access-error" role="alert">
          {google.error}
          <button className="text-button" onClick={google.reload}>
            Coba lagi
          </button>
        </div>
      )}
      {google.notice && <p role="status">{google.notice}</p>}
      <div className="account-actions">
        {google.status?.connected ? (
          <>
            <button className="primary-button" onClick={navigate}>
              Open Google Workspace
              <ArrowUpRight size={15} />
            </button>
            <button
              className="secondary-button"
              disabled={google.busy}
              onClick={google.sync}
            >
              <RefreshCw size={14} />
              {google.busy ? "Working…" : "Sync now"}
            </button>
          </>
        ) : (
          <button
            className="primary-button"
            disabled={
              google.busy || google.loading || !google.status?.configured
            }
            onClick={google.connect}
          >
            <Link2 size={15} />
            Connect Google Workspace
          </button>
        )}
      </div>
      {google.status && !google.status.configured && (
        <>
          <p>
            Aktivasi Google belum selesai. Konfigurasi Google Cloud dan server
            diperlukan sebelum tombol Connect aktif.
          </p>
          <GoogleSetup />
        </>
      )}
    </section>
  );
}
export function GoogleWorkspace() {
  const google = useGoogle();
  const [tab, setTab] = useState("Calendar");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<{
    name: string;
    text: string;
    rows?: string[][];
  }>();
  const [previewError, setPreviewError] = useState("");
  const [reading, setReading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!google)
    return (
      <Empty text="Login ke cloud workspace untuk menghubungkan Google." />
    );
  const snapshot = google.status?.snapshot;
  async function read(id: string) {
    if (reading) return;
    setReading(true);
    setPreviewError("");
    try {
      setPreview(await googleService.document(id));
    } catch (e) {
      setPreviewError(
        e instanceof Error ? e.message : "File tidak bisa dibaca.",
      );
    } finally {
      setReading(false);
    }
  }
  return (
    <div className="view-stack">
      <GoogleConnection
        navigate={() =>
          document
            .getElementById("google-sources")
            ?.scrollIntoView({ behavior: "smooth" })
        }
      />
      {google.status?.connected && (
        <>
          <div className="google-toolbar">
            <span>
              {google.status.lastSyncedAt
                ? `Last sync ${new Date(google.status.lastSyncedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`
                : "Belum ada data yang disinkronkan."}
            </span>
            <button
              className="text-button"
              disabled={google.busy}
              onClick={() => setConfirm(true)}
            >
              Disconnect account
            </button>
          </div>
          <div className="google-scope-note">
            Sync mengambil agenda dari maksimal 10 kalender yang dipilih untuk
            14 hari ke depan, 20 email inbox terbaru dalam 30 hari, dan 40 file
            Drive terbaru. Docs dan Sheets dapat dibaca sesuai izin akunmu.
          </div>
          {snapshot?.warnings.map((w) => (
            <div className="access-error" key={w}>
              {w}
            </div>
          ))}
          <div className="tabs" id="google-sources">
            {["Calendar", "Gmail", "Drive", "Docs", "Sheets"].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="google-search-label">
            Search synced items
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari agenda, email, atau file…"
            />
          </label>
          {!snapshot ? (
            <Empty text="Klik Sync now untuk mengambil data akun Google." />
          ) : (
            <>
              <p className="google-source-time">
                {snapshot.sourceUpdatedAt[
                  tab === "Calendar"
                    ? "events"
                    : tab === "Gmail"
                      ? "mail"
                      : "files"
                ]
                  ? `Source updated ${new Date(snapshot.sourceUpdatedAt[tab === "Calendar" ? "events" : tab === "Gmail" ? "mail" : "files"]).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`
                  : "Sumber ini belum berhasil disinkronkan."}
              </p>
              {tab === "Calendar"
                ? snapshot.events
                    .filter((e) =>
                      (e.title + " " + e.calendar)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((e) => (
                      <article className="panel google-item" key={e.id}>
                        <CalendarDays size={19} />
                        <div>
                          <h2>{e.title}</h2>
                          <p>
                            {e.allDay
                              ? `${e.start} · All day`
                              : new Date(e.start).toLocaleString("id-ID", {
                                  timeZone: "Asia/Jakarta",
                                }) + " WIB"}{" "}
                            · {e.calendar}
                          </p>
                          <small>
                            {e.location} {e.attendees.join(" · ")}
                          </small>
                        </div>
                        <a
                          href={safeGoogleUrl(e.url)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${e.title} in Google Calendar`}
                        >
                          <ArrowUpRight size={16} />
                        </a>
                      </article>
                    ))
                : tab === "Gmail"
                  ? snapshot.mail
                      .filter((m) =>
                        (m.subject + " " + m.from + " " + m.snippet)
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((m) => (
                        <article className="panel google-item" key={m.id}>
                          <Mail size={19} />
                          <div>
                            <h2>
                              {m.subject}{" "}
                              {m.unread && <Badge tone="amber">Unread</Badge>}
                            </h2>
                            <p>
                              {m.from} ·{" "}
                              {new Date(m.date).toLocaleDateString("id-ID", {
                                timeZone: "Asia/Jakarta",
                              })}
                            </p>
                            <small>{m.snippet}</small>
                          </div>
                          <a
                            href={safeGoogleUrl(m.url)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${m.subject} in Gmail`}
                          >
                            <ArrowUpRight size={16} />
                          </a>
                        </article>
                      ))
                  : snapshot.files
                      .filter(
                        (f) =>
                          (tab === "Drive" ||
                            f.mimeType ===
                              (tab === "Docs"
                                ? "application/vnd.google-apps.document"
                                : "application/vnd.google-apps.spreadsheet")) &&
                          f.name.toLowerCase().includes(query.toLowerCase()),
                      )
                      .map((f) => (
                        <article className="panel google-item" key={f.id}>
                          <FileText size={19} />
                          <div>
                            <h2>{f.name}</h2>
                            <p>
                              {f.owner} · Updated{" "}
                              {new Date(f.modifiedAt).toLocaleDateString(
                                "id-ID",
                                { timeZone: "Asia/Jakarta" },
                              )}
                            </p>
                          </div>
                          {[
                            "application/vnd.google-apps.document",
                            "application/vnd.google-apps.spreadsheet",
                          ].includes(f.mimeType) && (
                            <button
                              className="secondary-button"
                              disabled={reading}
                              onClick={() => read(f.id)}
                            >
                              {reading ? "Reading…" : "Read in OS"}
                            </button>
                          )}
                          <a
                            href={safeGoogleUrl(f.url)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${f.name} in Google Drive`}
                          >
                            <ArrowUpRight size={16} />
                          </a>
                        </article>
                      ))}
              {((tab === "Calendar" && !snapshot.events.length) ||
                (tab === "Gmail" && !snapshot.mail.length) ||
                (!["Calendar", "Gmail"].includes(tab) &&
                  !snapshot.files.some(
                    (f) =>
                      tab === "Drive" ||
                      f.mimeType ===
                        (tab === "Docs"
                          ? "application/vnd.google-apps.document"
                          : "application/vnd.google-apps.spreadsheet"),
                  ))) && (
                <Empty text="Tidak ada item pada sumber ini dalam batas sync saat ini." />
              )}
            </>
          )}
          {previewError && (
            <div className="access-error" role="alert">
              {previewError}
            </div>
          )}
        </>
      )}
      {preview && (
        <Modal title={preview.name} onClose={() => setPreview(undefined)}>
          <p className="muted">
            Read-only preview · Docs maksimal 70.000 karakter; Sheets tab
            pertama, 25 baris × 12 kolom.
          </p>
          {preview.rows ? (
            <div className="google-table-wrap">
              <table className="google-table">
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i}>
                      {r.map((v, j) => (
                        <td key={j}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!preview.rows.length && (
                <Empty text="Tidak ada nilai di rentang ini." />
              )}
            </div>
          ) : (
            <pre className="google-document">
              {preview.text ||
                "Dokumen tidak memiliki teks yang dapat ditampilkan."}
            </pre>
          )}
        </Modal>
      )}
      {confirm && (
        <Modal
          title="Disconnect Google Workspace?"
          onClose={() => setConfirm(false)}
        >
          <p>
            Hapus koneksi dan cache Google dari OS serta coba cabut izin Google.
            Proyek dan keputusan di workspace tetap tersimpan.
          </p>
          <button
            className="primary-button"
            disabled={google.busy}
            onClick={async () => {
              await google.disconnect();
              setConfirm(false);
            }}
          >
            Disconnect account
          </button>
        </Modal>
      )}
    </div>
  );
}
export function GoogleAgenda() {
  const google = useGoogle();
  const snapshot = google?.status?.snapshot;
  if (!snapshot) return null;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const events = snapshot.events.filter(
    (e) =>
      (e.allDay
        ? e.start
        : new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Jakarta",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(e.start))) === today,
  );
  return (
    <section className="panel google-agenda">
      <SectionTitle title="Agenda Google hari ini" count={events.length} />
      {events.map((e) => (
        <div className="google-agenda-row" key={e.id}>
          <span>
            {e.allDay
              ? "All day"
              : new Date(e.start).toLocaleTimeString("id-ID", {
                  timeZone: "Asia/Jakarta",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
          </span>
          <strong>{e.title}</strong>
          <a
            href={safeGoogleUrl(e.url)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${e.title}`}
          >
            <ArrowUpRight size={15} />
          </a>
        </div>
      ))}
      {!events.length && (
        <p className="muted">
          Tidak ada agenda hari ini pada data terakhir yang tersinkron.
        </p>
      )}
      <p className="google-source-time">
        Data Google terakhir diperbarui{" "}
        {snapshot.sourceUpdatedAt.events
          ? new Date(snapshot.sourceUpdatedAt.events).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })
          : "belum tersedia"}{" "}
        · WIB
      </p>
    </section>
  );
}
