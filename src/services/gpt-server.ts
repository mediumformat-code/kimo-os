import { createHash, timingSafeEqual } from "node:crypto";
import { adminClient, GoogleHttpError } from "@/integrations/google/server";
export function hashBridgeKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export async function bridgeOwner(request: Request) {
  const key = request.headers
    .get("authorization")
    ?.match(/^Bearer (kimo_[A-Za-z0-9_-]{40,100})$/)?.[1];
  if (!key) throw new GoogleHttpError(401, "Invalid integration key.");
  const hash = hashBridgeKey(key);
  const { data, error } = await adminClient()
    .from("gpt_bridge_keys")
    .select("owner_id,secret_hash,expires_at")
    .eq("secret_hash", hash)
    .maybeSingle();
  if (
    error ||
    !data ||
    Date.parse(data.expires_at) <= Date.now() ||
    !timingSafeEqual(Buffer.from(hash), Buffer.from(data.secret_hash))
  )
    throw new GoogleHttpError(401, "Integration key expired or revoked.");
  return data.owner_id as string;
}
export async function boundedBody(request: Request, maxBytes = 1000000) {
  const reader = request.body?.getReader();
  if (!reader) throw new GoogleHttpError(400, "Request body required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new GoogleHttpError(413, "Request is too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new GoogleHttpError(400, "Invalid JSON.");
  }
}
