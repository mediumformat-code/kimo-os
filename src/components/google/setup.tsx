"use client";
import { useState } from "react";
export function GoogleSetup() {
  const [key, setKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  function generate() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    setKey(btoa(String.fromCharCode(...bytes)));
    setCopied(false);
    setError("");
  }
  return (
    <details className="google-setup">
      <summary>Activation checklist</summary>
      <p>
        1. Buat project Google Cloud dan aktifkan Calendar, Gmail, Drive, Docs,
        dan Sheets API.
      </p>
      <p>2. Buat OAuth client Web application. Tambahkan redirect URI:</p>
      <code>
        {typeof window === "undefined"
          ? "https://YOUR_APP/api/google/callback"
          : window.location.origin + "/api/google/callback"}
      </code>
      <p>
        3. Tambahkan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI, GOOGLE_TOKEN_ENCRYPTION_KEY, dan
        SUPABASE_SERVICE_ROLE_KEY sebagai variabel server di Vercel. Jangan
        gunakan awalan NEXT_PUBLIC_ untuk token atau secret.
      </p>
      <p>4. Jalankan migrasi Google di Supabase, redeploy, lalu Connect.</p>
      <button className="secondary-button" onClick={generate}>
        Generate encryption key on this device
      </button>
      {key && (
        <>
          <label className="field-label">
            Encryption key
            <input type="password" readOnly value={key} />
          </label>
          <button
            className="secondary-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(key);
                setCopied(true);
              } catch {
                setError(
                  "Clipboard diblokir. Salin nilai input secara manual.",
                );
              }
            }}
          >
            {copied ? "Copied" : "Copy key for Vercel"}
          </button>
          <p>
            Key dibuat di browser ini dan tidak dikirim ke server. Simpan
            sebagai Secret di Vercel, jangan bagikan di chat. Mengganti key
            setelah akun terhubung membutuhkan reconnect.
          </p>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
