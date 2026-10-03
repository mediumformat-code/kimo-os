import { createClient, SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | undefined;
export function cloudConfiguration(): "demo" | "cloud" | "incomplete" {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
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
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (
      !url.startsWith("https://") &&
      !url.startsWith("http://localhost:") &&
      !url.startsWith("http://127.0.0.1:")
    )
      throw new Error("Use an HTTPS Supabase project URL.");
    client = createClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      },
    );
  }
  return client;
}
