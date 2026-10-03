import {
  authenticatedOwner,
  adminClient,
  getConnection,
  routeError,
  GoogleHttpError,
} from "@/integrations/google/server";
import { unseal } from "@/integrations/google/crypto";
import { GoogleCredentials } from "@/integrations/google/types";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const owner = await authenticatedOwner(request);
    const row = await getConnection(owner);
    let revoked = true;
    if (row) {
      const tokens = unseal<GoogleCredentials>(row.credentials);
      try {
        const result = await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: tokens.refreshToken }),
          signal: AbortSignal.timeout(10000),
        });
        revoked = result.ok || result.status === 400;
      } catch {
        revoked = false;
      }
      const { error } = await adminClient()
        .from("google_connections")
        .delete()
        .eq("owner_id", owner);
      if (error)
        throw new GoogleHttpError(
          503,
          "Koneksi belum bisa dihapus. Coba lagi.",
        );
    }
    return Response.json(
      { disconnected: true, revoked },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
