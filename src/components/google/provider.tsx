"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { GoogleStatus } from "@/integrations/google/types";
import { googleService } from "@/services/google";
interface GoogleContextValue {
  status: GoogleStatus | null;
  loading: boolean;
  busy: boolean;
  error: string;
  notice: string;
  connect: () => Promise<void>;
  sync: () => Promise<void>;
  disconnect: () => Promise<void>;
  reload: () => Promise<void>;
}
const Context = createContext<GoogleContextValue | null>(null);
export function useGoogle() {
  return useContext(Context);
}
export function GoogleProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await googleService.status());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koneksi belum tersedia.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    googleService
      .status()
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Koneksi belum tersedia.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const outcome = new URLSearchParams(window.location.search).get("google");
    if (outcome)
      queueMicrotask(() => {
        if (active) {
          setNotice(
            outcome === "connected"
              ? "Akun Google terhubung. Klik Sync now untuk mengambil data."
              : "Koneksi Google belum berhasil. Periksa konfigurasi OAuth lalu coba lagi.",
          );
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.hash,
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koneksi Google gagal.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Context.Provider
      value={{
        status,
        loading,
        busy,
        error,
        notice,
        reload,
        connect: () =>
          run(async () => {
            const result = await googleService.connect();
            window.location.assign(result.url);
          }),
        sync: () =>
          run(async () => {
            const result = await googleService.sync();
            setStatus((s) => (s ? { ...s, ...result } : s));
            setNotice("Data Google berhasil diperbarui.");
            window.dispatchEvent(new Event("kimo-business-sync"));
          }),
        disconnect: () =>
          run(async () => {
            const result = await googleService.disconnect();
            setStatus({ configured: true, connected: false });
            setNotice(
              result.revoked
                ? "Koneksi dan data Google di OS sudah dihapus."
                : "Koneksi OS dihapus. Cabut izin tambahan melalui pengaturan akun Google.",
            );
          }),
      }}
    >
      {children}
    </Context.Provider>
  );
}
