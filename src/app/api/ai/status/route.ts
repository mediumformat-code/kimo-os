import { authenticatedOwner, routeError } from "@/integrations/google/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await authenticatedOwner(request);
    return Response.json(
      {
        configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1",
        privateChatGptHistoryConnected: false,
        plaudAccountConnected: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
