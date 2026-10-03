import {
  authenticatedOwner,
  accessToken,
  routeError,
  GoogleHttpError,
} from "@/integrations/google/server";
import { googleGet, documentText } from "@/integrations/google/adapters";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const owner = await authenticatedOwner(request);
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    const gid = params.get("gid");
    if (gid && !/^\d{1,12}$/.test(gid))
      throw new GoogleHttpError(400, "Tab ID tidak valid.");
    const importing = params.get("mode") === "import";
    if (!id || !/^[-\w]{1,200}$/.test(id))
      throw new GoogleHttpError(400, "File tidak valid.");
    const token = await accessToken(owner);
    const file = await googleGet<{ name: string; mimeType: string }>(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=name,mimeType&supportsAllDrives=true`,
      token,
    );
    let text = "";
    let rows: string[][] | undefined;
    if (file.mimeType === "application/vnd.google-apps.document") {
      const doc = await googleGet<unknown>(
        `https://docs.googleapis.com/v1/documents/${id}?includeTabsContent=true`,
        token,
      );
      text = documentText(doc);
    } else if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
      const sheet = await googleGet<{
        sheets?: { properties: { title: string; sheetId: number } }[];
      }>(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets(properties(sheetId,title))`,
        token,
      );
      const title = (
        gid
          ? sheet.sheets?.find((s) => String(s.properties.sheetId) === gid)
          : sheet.sheets?.[0]
      )?.properties.title;
      if (!title)
        throw new GoogleHttpError(
          404,
          "Tab sumber tidak ditemukan. Periksa akses akun dan tab ID.",
        );
      if (title) {
        const range = `'${title.replaceAll("'", "''")}'!${importing ? "A1:AZ500" : "A1:L25"}`;
        const values = await googleGet<{ values?: unknown[][] }>(
          `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}`,
          token,
        );
        rows = (values.values ?? []).map((r) => r.map((v) => String(v)));
      }
    } else
      throw new GoogleHttpError(
        400,
        "Preview tersedia untuk Google Docs dan Sheets. Buka file lainnya di Google Drive.",
      );
    return Response.json(
      {
        name: file.name,
        text,
        rows,
        limited: true,
        ...(importing ? { limit: 500 } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
