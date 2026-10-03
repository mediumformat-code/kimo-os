import { getSupabase } from "@/lib/supabase";
export interface BusinessPreview {
  hash: string;
  inputHash: string;
  canEdit: boolean;
  patchCount: number;
  changes: string[];
  warnings: string[];
  examples: { tab: string; cell: string; before: string; after: string }[];
  counts: {
    projects: number;
    tasks: number;
    leads: number;
    commercial: number;
    tabs: number;
  };
  backups: { source: string; url: string }[];
}
export async function liveGoogle<T>(body?: unknown): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  if (!data.session) throw new Error("Login kembali untuk sync Google.");
  const response = await fetch("/api/google/business", {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Sync Google Sheets gagal.");
  return result;
}
