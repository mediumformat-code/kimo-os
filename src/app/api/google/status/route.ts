import {
  authenticatedOwner,
  getConnection,
  googleConfigured,
  routeError,
} from "@/integrations/google/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const owner = await authenticatedOwner(request);
    if (!googleConfigured())
      return Response.json(
        { configured: false, connected: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    const row = await getConnection(owner);
    return Response.json(
      {
        configured: true,
        connected: !!row,
        ...(row
          ? {
              email: row.email,
              scopes: row.scopes,
              lastSyncedAt: row.last_synced_at,
              snapshot: row.snapshot,
            }
          : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
