import { createClient } from "@supabase/supabase-js";
import { GoogleCredentials } from "./types";
import { seal, unseal, encryptionKey } from "./crypto";
export class GoogleHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function googleConfigured() {
  return [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "GOOGLE_TOKEN_ENCRYPTION_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].every((k) => !!process.env[k]?.trim());
}
export function googleConfig() {
  if (!googleConfigured())
    throw new GoogleHttpError(
      503,
      "Google Workspace belum diaktifkan di server. Ikuti panduan setup Google.",
    );
  encryptionKey();
  const redirect = new URL(process.env.GOOGLE_REDIRECT_URI!.trim());
  if (
    redirect.pathname !== "/api/google/callback" ||
    (redirect.protocol !== "https:" && redirect.hostname !== "localhost")
  )
    throw new GoogleHttpError(503, "Google redirect URI tidak valid.");
  return {
    clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
    redirectUri: redirect.toString(),
    origin: redirect.origin,
  };
}
export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function authenticatedOwner(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new GoogleHttpError(401, "Silakan login kembali.");
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user)
    throw new GoogleHttpError(
      401,
      "Sesi login tidak valid. Silakan login kembali.",
    );
  return data.user.id;
}
export async function googleTokenRequest(parameters: Record<string, string>) {
  const config = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...parameters,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new GoogleHttpError(
      401,
      "Izin Google kedaluwarsa atau ditolak. Hubungkan ulang akun Google.",
    );
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
}
export async function getConnection(owner: string) {
  const { data, error } = await adminClient()
    .from("google_connections")
    .select("*")
    .eq("owner_id", owner)
    .maybeSingle();
  if (error)
    throw new GoogleHttpError(
      503,
      "Database koneksi Google belum siap. Jalankan migrasi Google di Supabase.",
    );
  return data;
}
export async function accessToken(owner: string) {
  const connection = await getConnection(owner);
  if (!connection)
    throw new GoogleHttpError(409, "Hubungkan akun Google terlebih dahulu.");
  const tokens = unseal<GoogleCredentials>(connection.credentials);
  if (tokens.expiresAt > Date.now() + 60000) return tokens.accessToken;
  const fresh = await googleTokenRequest({
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
  });
  const credentials = seal({
    accessToken: fresh.access_token,
    refreshToken: fresh.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + fresh.expires_in * 1000,
  });
  const { error } = await adminClient()
    .from("google_connections")
    .update({ credentials })
    .eq("owner_id", owner);
  if (error)
    throw new GoogleHttpError(
      503,
      "Token Google tidak bisa disimpan. Coba lagi.",
    );
  return fresh.access_token;
}
export function routeError(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof GoogleHttpError
          ? error.message
          : "Koneksi layanan belum tersedia. Periksa konfigurasi server dan coba kembali.",
    },
    {
      status: error instanceof GoogleHttpError ? error.status : 502,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
