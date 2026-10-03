import {
  authenticatedOwner,
  accessToken,
  getConnection,
  adminClient,
  routeError,
  GoogleHttpError,
} from "@/integrations/google/server";
import { syncGoogle } from "@/integrations/google/adapters";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const owner = await authenticatedOwner(request);
    const connection = await getConnection(owner);
    const token = await accessToken(owner);
    const snapshot = await syncGoogle(token, connection?.snapshot);
    const { error } = await adminClient()
      .from("google_connections")
      .update({ snapshot, last_synced_at: snapshot.updatedAt })
      .eq("owner_id", owner);
    if (error)
      throw new GoogleHttpError(
        503,
        "Data Google belum bisa disimpan. Coba sync kembali.",
      );
    return Response.json(
      { snapshot, lastSyncedAt: snapshot.updatedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
