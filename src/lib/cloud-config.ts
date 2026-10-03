export class CloudConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudConfigurationError";
  }
}
export function normalizePublicValue(value: string | undefined) {
  return (value ?? "")
    .trim()
    .replace(/^(["'])(.*)\1$/s, "$2")
    .trim();
}
export function validateCloudConfig(
  rawUrl: string | undefined,
  rawKey: string | undefined,
) {
  const url = normalizePublicValue(rawUrl);
  const key = normalizePublicValue(rawKey);
  if (!url)
    throw new CloudConfigurationError(
      "Project URL belum terisi. Isi NEXT_PUBLIC_SUPABASE_URL di Vercel, lalu redeploy.",
    );
  if (!key)
    throw new CloudConfigurationError(
      "Publishable key belum terisi. Isi NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY di Vercel, lalu redeploy.",
    );
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CloudConfigurationError(
      "Project URL tidak valid. Salin Project URL dari Supabase, bukan alamat dashboard atau aplikasi.",
    );
  }
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))
    throw new CloudConfigurationError(
      "Project URL harus diawali https://. Salin ulang Project URL dari Supabase.",
    );
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !["", "/"].includes(parsed.pathname)
  )
    throw new CloudConfigurationError(
      "Gunakan Project URL saja, tanpa path, parameter, atau informasi login.",
    );
  if (
    parsed.hostname.endsWith(".vercel.app") ||
    parsed.hostname === "supabase.com"
  )
    throw new CloudConfigurationError(
      "URL yang dimasukkan adalah alamat aplikasi/dashboard. Gunakan Project URL Supabase yang berakhiran .supabase.co.",
    );
  if (key.startsWith("sb_secret_"))
    throw new CloudConfigurationError(
      "Key yang dimasukkan adalah secret key. Ganti dengan Publishable key dari Supabase.",
    );
  return { url: parsed.origin, key };
}
export function startupErrorMessage(error: unknown) {
  if (error instanceof CloudConfigurationError) return error.message;
  if (error instanceof DOMException && error.name === "SecurityError")
    return "Browser memblokir penyimpanan sesi login. Izinkan penyimpanan situs atau coba browser lain.";
  return "Login belum bisa dimulai di browser ini. Coba refresh atau browser lain. Jika tetap gagal, periksa konfigurasi Supabase di Vercel.";
}
