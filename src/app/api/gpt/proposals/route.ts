import { createClient } from "@supabase/supabase-js";
import { bridgeOwner, boundedBody } from "@/services/gpt-server";
import {
  authenticatedOwner,
  adminClient,
  routeError,
  GoogleHttpError,
} from "@/integrations/google/server";
import { isWorkspace } from "@/services/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const owner = await bridgeOwner(request);
    const body = (await boundedBody(request)) as {
      title?: unknown;
      workspace?: unknown;
    };
    if (
      !body ||
      typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.length > 200 ||
      !isWorkspace(body.workspace)
    )
      throw new GoogleHttpError(
        400,
        "Provide a title and a complete valid workspace snapshot.",
      );
    const { data, error } = await adminClient()
      .from("gpt_proposals")
      .insert({
        owner_id: owner,
        title: body.title.trim(),
        payload: {
          ...body.workspace,
          metadata: {
            dataset: "live",
            sourceName: "Custom GPT proposal",
            importedAt: new Date().toISOString(),
          },
        },
      })
      .select("id,status")
      .single();
    if (error) throw new GoogleHttpError(503, "Proposal could not be saved.");
    return Response.json(
      {
        ...data,
        message:
          "Awaiting owner review in KIMO OS. No workspace change has been applied.",
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return routeError(e);
  }
}
export async function GET(request: Request) {
  try {
    const owner = await authenticatedOwner(request);
    const { data, error } = await adminClient()
      .from("gpt_proposals")
      .select("id,title,payload,status,created_at")
      .eq("owner_id", owner)
      .eq("status", "Review")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error)
      throw new GoogleHttpError(503, "Jalankan migrasi GPT terlebih dahulu.");
    return Response.json(
      { proposals: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return routeError(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const owner = await authenticatedOwner(request);
    const body = (await boundedBody(request, 5000)) as {
      id?: unknown;
      action?: unknown;
      expectedRevision?: unknown;
    };
    if (
      !body ||
      typeof body.id !== "string" ||
      !["apply", "reject"].includes(body.action as string)
    )
      throw new GoogleHttpError(400, "Invalid proposal action.");
    if (body.action === "reject") {
      const { error } = await adminClient()
        .from("gpt_proposals")
        .update({ status: "Rejected" })
        .eq("id", body.id)
        .eq("owner_id", owner)
        .eq("status", "Review");
      if (error)
        throw new GoogleHttpError(503, "Proposal could not be rejected.");
      return Response.json({ rejected: true });
    }
    if (
      !Number.isInteger(body.expectedRevision) ||
      Number(body.expectedRevision) < 0
    )
      throw new GoogleHttpError(400, "Workspace revision required.");
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(),
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          headers: { Authorization: request.headers.get("authorization")! },
        },
      },
    );
    const { data, error } = await userClient.rpc("apply_gpt_proposal", {
      proposal_id: body.id,
      expected_revision: body.expectedRevision,
    });
    if (error)
      throw new GoogleHttpError(
        error.code === "40001" ? 409 : 403,
        error.code === "40001"
          ? "Workspace berubah di perangkat lain. Reload sebelum menerapkan proposal."
          : "Proposal tidak tersedia untuk diterapkan.",
      );
    return Response.json(
      { revision: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return routeError(e);
  }
}
