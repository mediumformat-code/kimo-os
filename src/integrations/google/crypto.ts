import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export function encryptionKey() {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("Google connection encryption is not configured.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32)
    throw new Error("Google connection encryption key must contain 32 bytes.");
  return key;
}
export function seal(value: unknown, key = encryptionKey()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function unseal<T>(value: string, key = encryptionKey()): T {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted payload.");
  const [iv, tag, data] = parts.map((p) => Buffer.from(p, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key, iv);
  cipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8"),
  ) as T;
}
