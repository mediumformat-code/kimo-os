import { randomBytes } from "node:crypto";
import {
  authenticatedOwner,
  adminClient,
  routeError,
  GoogleHttpError,
} from "@/integrations/google/server";
import { hashBridgeKey } from "@/services/gpt-server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const owner = await authenticatedOwner(request);
    const key = `kimo_${randomBytes(32).toString("base64url")}`;
    const expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
    const { error } = await adminClient()
      .from("gpt_bridge_keys")
      .upsert({
        owner_id: owner,
        secret_hash: hashBridgeKey(key),
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      });
    if (error)
      throw new GoogleHttpError(
        503,
        "Jalankan migrasi GPT di Supabase terlebih dahulu.",
      );
    return Response.json(
      { key, expiresAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return routeError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const owner = await authenticatedOwner(request);
    const { error } = await adminClient()
      .from("gpt_bridge_keys")
      .delete()
      .eq("owner_id", owner);
    if (error) throw new GoogleHttpError(503, "Key belum dapat dicabut.");
    return Response.json(
      { revoked: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return routeError(e);
  }
}
