import { createClient } from "@supabase/supabase-js";
import {
  authenticatedOwner,
  accessToken,
  getConnection,
  adminClient,
  GoogleHttpError,
  routeError,
} from "@/integrations/google/server";
import {
  readLiveSheets,
  sourceHash,
  refinementPlan,
  applyRefinements,
  SHEETS_WRITE_SCOPE,
} from "@/integrations/google/business";
import { prepareBusinessSheets } from "@/services/business-import";
import {
  prepareLiveBusiness,
  mergeLiveBusiness,
} from "@/services/live-business";
import { isWorkspace } from "@/services/validation";
import { mockWorkspace } from "@/data/mock";
import { boundedBody } from "@/services/gpt-server";
export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "no-store" };
async function stored(owner: string) {
  const { data, error } = await adminClient()
    .from("workspaces")
    .select("data,revision")
    .eq("owner_id", owner)
    .maybeSingle();
  if (!error && !data)
    return {
      data: {
        ...structuredClone(mockWorkspace),
        metadata: { dataset: "sample" as const },
      },
      revision: 0,
    };
  if (error || !data || !isWorkspace(data.data))
    throw new GoogleHttpError(
      409,
      "Workspace harus tersimpan dan valid sebelum sync live.",
    );
  return { data: data.data, revision: data.revision };
}
export async function GET(request: Request) {
  try {
    const owner = await authenticatedOwner(request);
    const connection = await getConnection(owner);
    const sheets = await readLiveSheets(await accessToken(owner));
    const plan = refinementPlan(sheets);
    const virtual = structuredClone(sheets);
    for (const p of plan.patches.filter((p) => !p.formula)) {
      const sheet = virtual.find((s) => s.id === p.sheet)!;
      sheet.rows[p.row - 1] ??= [];
      sheet.rows[p.row - 1][p.column - 1] = p.value;
    }
    const preview = prepareBusinessSheets(virtual);
    return Response.json(
      {
        hash: sourceHash(sheets),
        canEdit: connection?.scopes?.includes(SHEETS_WRITE_SCOPE) ?? false,
        patchCount: plan.patches.length,
        changes: [...new Set(plan.patches.map((p) => p.reason))],
        examples: [...plan.patches]
          .sort((a, b) => Number(b.formula) - Number(a.formula))
          .slice(0, 30)
          .map((p) => {
            const sheet = sheets.find((s) => s.id === p.sheet)!;
            let n = p.column,
              column = "";
            while (n > 0) {
              n--;
              column = String.fromCharCode(65 + (n % 26)) + column;
              n = Math.floor(n / 26);
            }
            return {
              tab: sheet.title,
              cell: `${column}${p.row}`,
              before:
                sheet.formulas[p.row - 1]?.[p.column - 1] ??
                sheet.rows[p.row - 1]?.[p.column - 1] ??
                "",
              after: p.value,
            };
          }),
        warnings: plan.warnings,
        counts: {
          projects: preview.projects.length,
          tasks: preview.actions.length,
          leads: preview.sourceRecords?.filter((r) => r.kind === "lead").length,
          commercial: preview.sourceRecords?.filter(
            (r) => r.kind === "commercial",
          ).length,
          tabs: sheets.length,
        },
        backups: connection?.snapshot?.businessRefinement?.backups ?? [],
      },
      { headers },
    );
  } catch (e) {
    return routeError(e);
  }
}
export async function POST(request: Request) {
  try {
    const owner = await authenticatedOwner(request);
    const body = (await boundedBody(request)) as {
      action?: string;
      hash?: string;
      expectedRevision?: number;
    };
    if (!["refine", "enable", "sync"].includes(body.action ?? ""))
      throw new GoogleHttpError(400, "Action tidak valid.");
    const current = await stored(owner);
    const connection = await getConnection(owner);
    if (body.action === "sync" && !current.data.businessSync?.enabled)
      throw new GoogleHttpError(409, "Sync live belum diaktifkan.");
    const token = await accessToken(owner);
    let sheets = await readLiveSheets(token);
    let hash = sourceHash(sheets);
    let plan = refinementPlan(sheets);
    if (body.action === "refine") {
      if (!connection?.scopes?.includes(SHEETS_WRITE_SCOPE))
        throw new GoogleHttpError(
          403,
          "Connect Google dengan izin edit Sheets dahulu.",
        );
      if (body.hash !== hash)
        throw new GoogleHttpError(
          409,
          "Sheet berubah sejak preview. Baca preview kembali sebelum refine.",
        );
      let backups: { source: string; url: string }[] = [];
      try {
        backups = await applyRefinements(token, sheets, plan, async (saved) => {
          backups = saved;
          if (sourceHash(await readLiveSheets(token)) !== hash)
            throw new GoogleHttpError(
              409,
              "Source berubah selama backup; preview ulang sebelum refine.",
            );
          const snapshot = {
            events: [],
            mail: [],
            files: [],
            updatedAt: new Date().toISOString(),
            sourceUpdatedAt: {},
            warnings: [],
            ...connection?.snapshot,
            businessRefinement: {
              at: new Date().toISOString(),
              phase: "Backed up — source refinements may be in progress",
              backups: saved,
            },
          };
          const { error } = await adminClient()
            .from("google_connections")
            .update({ snapshot })
            .eq("owner_id", owner);
          if (error)
            throw new GoogleHttpError(
              503,
              "Backup metadata belum tersimpan; source tidak diubah.",
            );
        });
      } catch {
        throw new GoogleHttpError(
          503,
          "Refine belum selesai; beberapa sumber mungkin telah diperbaiki. Baca preview untuk retry. Backup tersedia di Sources jika tahap backup sudah selesai.",
        );
      }
      const saved = await getConnection(owner);
      if (saved?.snapshot)
        await adminClient()
          .from("google_connections")
          .update({
            snapshot: {
              ...saved.snapshot,
              businessRefinement: {
                at: new Date().toISOString(),
                phase: "Complete",
                backups,
              },
            },
          })
          .eq("owner_id", owner);
      return Response.json(
        { refined: true, backups, patchCount: plan.patches.length },
        { headers },
      );
    }
    if (body.action === "enable" && body.hash !== hash)
      throw new GoogleHttpError(
        409,
        "Source berubah sejak review. Preview ulang sebelum aktivasi.",
      );
    if (
      body.action === "sync" &&
      plan.patches.length &&
      plan.patches.every(
        (p) =>
          p.reason === "Add stable source identity without changing native ID",
      ) &&
      connection?.scopes?.includes(SHEETS_WRITE_SCOPE)
    ) {
      await applyRefinements(
        token,
        sheets,
        { ...plan, statuses: {} },
        async (backups) => {
          if (sourceHash(await readLiveSheets(token)) !== hash)
            throw new GoogleHttpError(
              409,
              "Source berubah selama backup; coba Sync kembali.",
            );
          const latest = await getConnection(owner);
          const snapshot = latest?.snapshot;
          if (!snapshot)
            throw new GoogleHttpError(
              503,
              "Connection snapshot unavailable; source retained.",
            );
          const { error } = await adminClient()
            .from("google_connections")
            .update({
              snapshot: {
                ...snapshot,
                businessRefinement: {
                  at: new Date().toISOString(),
                  phase: "New row identity backup",
                  backups,
                },
              },
            })
            .eq("owner_id", owner);
          if (error)
            throw new GoogleHttpError(
              503,
              "Backup metadata could not be saved; source retained.",
            );
        },
      );
      sheets = await readLiveSheets(token);
      hash = sourceHash(sheets);
      plan = refinementPlan(sheets);
    }
    if (plan.patches.length)
      throw new GoogleHttpError(
        409,
        "Source membutuhkan refinement sebelum masuk OS. Buka Sources → Live Google Sheets.",
      );
    if (
      body.action === "sync" &&
      current.data.businessSync?.sourceHash === hash
    )
      return Response.json(
        { changed: false, checkedAt: new Date().toISOString() },
        { headers },
      );
    if (
      !Number.isInteger(body.expectedRevision) ||
      body.expectedRevision !== current.revision
    )
      throw new GoogleHttpError(
        409,
        "Workspace berubah di perangkat lain. Reload sebelum sync.",
      );
    const incoming = prepareLiveBusiness(sheets);
    const next = mergeLiveBusiness(current.data, incoming, hash, plan.warnings);
    const user = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(),
      {
        auth: { persistSession: false },
        global: {
          headers: { Authorization: request.headers.get("authorization")! },
        },
      },
    );
    const { data: revision, error } = await user.rpc("save_workspace", {
      workspace_data: next,
      expected_revision: body.expectedRevision,
    });
    if (error)
      throw new GoogleHttpError(
        409,
        "Sync tidak disimpan karena perubahan bersamaan. Reload dan coba lagi.",
      );
    return Response.json(
      {
        changed: true,
        revision,
        lastSyncedAt: next.businessSync?.lastSyncedAt,
        counts: {
          projects: incoming.projects.length,
          tasks: incoming.actions.length,
        },
        warnings: plan.warnings,
      },
      { headers },
    );
  } catch (e) {
    return routeError(e);
  }
}
