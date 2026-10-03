"use client";
import { useState } from "react";
import type { Workspace } from "@/domain/models";
import { liveGoogle, BusinessPreview } from "@/services/live-google";
import { googleService } from "@/services/google";
import { downloadWorkspace } from "@/services/import-workspace";
import { useGoogle } from "./provider";
export function LiveBusiness({
  data,
  refresh,
  expectedRevision,
  save,
}: {
  data: Workspace;
  refresh: () => void;
  expectedRevision?: () => number | undefined;
  save: (data: Workspace, message: string) => Promise<boolean>;
}) {
  const google = useGoogle();
  const [preview, setPreview] = useState<BusinessPreview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [backup, setBackup] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koneksi gagal.");
      // Re-read without clearing the original failure: show remaining patches
      // and persisted backup links after a partial refinement.
      try {
        setPreview(await liveGoogle<BusinessPreview>());
        setReviewed(false);
      } catch {
        /* Preserve the last known preview if Google is unavailable. */
      }
    } finally {
      setBusy(false);
    }
  }
  async function read() {
    const p = await liveGoogle<BusinessPreview>();
    setPreview(p);
    setReviewed(false);
    setBackup(false);
  }
  return (
    <section className="panel detail-card">
      <h2>Live Google Sheets — DDO / DDS</h2>
      <p>
        Tiga Google Sheets menjadi sumber utama. DDO hanya dibaca untuk memantau
        progres; formula, validasi dan isi DDO tidak diubah. Perapihan sebelum
        aktivasi hanya berlaku untuk DDS; XLSX tidak diperlukan. Tab log,
        salinan dan ringkasan tidak menjadi proyek. Sheet sumber mengendalikan
        status task; perubahan OS tidak ditulis balik ke Sheets.
      </p>
      <p>
        {data.businessSync?.enabled
          ? `Active · last update ${new Date(data.businessSync.lastSyncedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`
          : "Belum aktif"}{" "}
        · auto-check setiap 5 menit selama OS terbuka. Baris baru DDS diberi KIMO
        Row Key setelah backup; perubahan formula DDS lain perlu review ulang.
      </p>
      <div className="account-actions">
        <button
          className="primary-button"
          disabled={busy || !google?.status?.connected}
          onClick={() => run(read)}
        >
          Read & review live sheets
        </button>
        {data.businessSync?.enabled && (
          <>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await liveGoogle({
                    action: "sync",
                    expectedRevision: expectedRevision?.(),
                  });
                  refresh();
                  setNotice("Live sheets diperiksa.");
                })
              }
            >
              Sync sheets now
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (
                    await save(
                      {
                        ...data,
                        businessSync: { ...data.businessSync!, enabled: false },
                      },
                      "Live sync paused",
                    )
                  )
                    setNotice("Live sync dihentikan.");
                })
              }
            >
              Pause live sync
            </button>
          </>
        )}
      </div>
      {!google?.status?.connected && (
        <p>Hubungkan Google di Settings dahulu.</p>
      )}
      {busy && <p>Processing source sheets…</p>}
      {error && (
        <div role="alert" className="access-error">
          {error}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {preview && (
        <>
          <p>
            {preview.counts.projects} projects · {preview.counts.tasks} tasks ·{" "}
            {preview.counts.leads} leads · {preview.counts.commercial}{" "}
            commercial records · {preview.counts.tabs} source tabs.
          </p>
          <h3>Refinement preview · {preview.patchCount} cell changes</h3>
          <ul>
            {preview.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <details>
            <summary>Preview cell changes (up to 30)</summary>
            {preview.examples.map((e) => (
              <p className="live-cell-preview" key={`${e.tab}:${e.cell}`}>
                <strong>
                  {e.tab} · {e.cell}
                </strong>
                <br />
                Before: <code>{e.before || "empty"}</code>
                <br />
                After: <code>{e.after}</code>
              </p>
            ))}
          </details>
          {preview.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          {preview.backups.length > 0 && (
            <>
              <h3>Source backups</h3>
              {preview.backups.map((b) => (
                <p key={b.url}>
                  <a href={b.url} target="_blank" rel="noreferrer">
                    Open Google source backup
                  </a>
                </p>
              ))}
            </>
          )}
          {!preview.canEdit && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { url } = await googleService.connect(true);
                  window.location.assign(url);
                })
              }
            >
              Connect Google with Sheets edit permission
            </button>
          )}
          <label className="field-label">
            <span>
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />{" "}
              Saya sudah review perubahan dan catatan accounting. Backup dibuat
              sebelum source diperbaiki.
            </span>
          </label>
          {preview.patchCount > 0 ? (
            <button
              className="primary-button"
              disabled={busy || !preview.canEdit || !reviewed}
              onClick={() =>
                run(async () => {
                  await liveGoogle({
                    action: "refine",
                    hash: preview.hash,
                    inputHash: preview.inputHash,
                  });
                  setNotice(
                    "Refine source selesai. Baca ulang preview untuk aktivasi sync.",
                  );
                  await google?.reload();
                  await read();
                })
              }
            >
              Back up & refine source sheets
            </button>
          ) : (
            <>
              <button
                className="secondary-button"
                onClick={() => {
                  downloadWorkspace(data);
                  setBackup(true);
                }}
              >
                Download OS backup before activation
              </button>
              <p>
                Aktivasi mengganti data contoh atau hasil impor sheet sebelumnya
                dengan sumber live, sambil mempertahankan keputusan/meeting
                terkait. Sumber Google menjadi otoritas untuk data yang
                disinkronkan.
              </p>
              <button
                className="primary-button"
                disabled={busy || !reviewed || !backup}
                onClick={() =>
                  run(async () => {
                    await liveGoogle({
                      action: "enable",
                      hash: preview.hash,
                      expectedRevision: expectedRevision?.(),
                    });
                    refresh();
                    setNotice("Live Sheets → OS sync aktif.");
                    setPreview(undefined);
                  })
                }
              >
                Activate live Sheets → OS sync
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
