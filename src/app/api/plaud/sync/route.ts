import {
  authenticatedOwner,
  adminClient,
  GoogleHttpError,
  routeError,
} from "@/integrations/google/server";
import { boundedBody, bridgeOwner } from "@/services/gpt-server";
import { syncPlaud } from "@/services/plaud";
import { isWorkspace } from "@/services/validation";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
async function owner(request: Request) {
  return request.headers.get("authorization")?.startsWith("Bearer kimo_")
    ? bridgeOwner(request)
    : authenticatedOwner(request);
}
export async function GET(request: Request) {
  try {
    const id = await owner(request);
    const { data, error } = await adminClient()
      .from("workspaces")
      .select("data,revision")
      .eq("owner_id", id)
      .single();
    if (error || !data || !isWorkspace(data.data))
      throw new GoogleHttpError(409, "Simpan workspace sebelum sync Plaud.");
    return Response.json(
      {
        sources: data.data.plaudSources ?? [],
        sync: data.data.plaudSync ?? null,
        revision: data.revision,
      },
      { headers },
    );
  } catch (e) {
    return routeError(e);
  }
}
export async function POST(request: Request) {
  try {
    const id = await owner(request);
    const body = await boundedBody(request, 400000);
    const db = adminClient();
    const result = await syncPlaud(
      {
        async read() {
          const { data, error } = await db
            .from("workspaces")
            .select("data,revision")
            .eq("owner_id", id)
            .single();
          if (error || !data || !isWorkspace(data.data))
            throw new Error("Workspace unavailable");
          return { data: data.data, revision: data.revision };
        },
        async write(data, revision) {
          if (
            !isWorkspace(data) ||
            Buffer.byteLength(JSON.stringify(data)) > 5242880
          )
            throw new Error("Invalid workspace");
          const { data: row, error } = await db
            .from("workspaces")
            .update({
              data,
              revision: revision + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("owner_id", id)
            .eq("revision", revision)
            .select("revision")
            .maybeSingle();
          if (error) throw new Error("Workspace write failed");
          return !!row;
        },
      },
      body,
    );
    return Response.json(result, { headers });
  } catch (e) {
    // No provider response, credentials or arbitrary exception text in HTTP output.
    if (e instanceof GoogleHttpError) return routeError(e);
    return Response.json(
      {
        error:
          "Rekaman belum tersimpan. Periksa format, relevansi proyek, dan koneksi; retry dengan ID Plaud yang sama.",
      },
      { status: 503, headers },
    );
  }
}
