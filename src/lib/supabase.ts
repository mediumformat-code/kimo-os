import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { normalizePublicValue, validateCloudConfig } from "./cloud-config";
let client: SupabaseClient | undefined;
export function cloudConfiguration(): "demo" | "cloud" | "incomplete" {
  const url = normalizePublicValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = normalizePublicValue(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  if (!url && !key) return "demo";
  if (!url || !key) return "incomplete";
  return "cloud";
}
export function getSupabase(): SupabaseClient {
  if (cloudConfiguration() !== "cloud")
    throw new Error(
      "Supabase configuration is incomplete. Set the project URL and public publishable key.",
    );
  if (!client) {
    const { url, key } = validateCloudConfig(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
  }
  return client;
}
