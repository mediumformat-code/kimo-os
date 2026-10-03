import { getSupabase } from "@/lib/supabase";
import { GoogleStatus, GoogleSnapshot } from "@/integrations/google/types";
export async function googleRequest<T>(
  path: string,
  method = "GET",
): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  if (!data.session) throw new Error("Silakan login kembali.");
  const response = await fetch(`/api/google/${path}`, {
    method,
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    cache: "no-store",
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      "Google Workspace belum tersedia di deployment ini. Tunggu deployment terbaru.",
    );
  }
  if (!response.ok) throw new Error(body.error ?? "Koneksi Google gagal.");
  return body as T;
}
export const googleService = {
  status: () => googleRequest<GoogleStatus>("status"),
  connect: () => googleRequest<{ url: string }>("connect", "POST"),
  sync: () =>
    googleRequest<{ snapshot: GoogleSnapshot; lastSyncedAt: string }>(
      "sync",
      "POST",
    ),
  disconnect: () =>
    googleRequest<{ disconnected: boolean; revoked: boolean }>(
      "disconnect",
      "POST",
    ),
  document: (id: string, gid?: string, importing = false) =>
    googleRequest<{
      name: string;
      text: string;
      rows?: string[][];
      limited: boolean;
    }>(
      `document?id=${encodeURIComponent(id)}${gid ? "&gid=" + encodeURIComponent(gid) : ""}${importing ? "&mode=import" : ""}`,
    ),
};
