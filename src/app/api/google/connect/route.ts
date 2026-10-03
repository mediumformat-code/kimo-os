import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import {
  authenticatedOwner,
  googleConfig,
  routeError,
} from "@/integrations/google/server";
import { seal } from "@/integrations/google/crypto";
import { SHEETS_WRITE_SCOPE } from "@/integrations/google/business";
import { GOOGLE_SCOPES } from "@/integrations/google/types";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const owner = await authenticatedOwner(request);
    const config = googleConfig();
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: (new URL(request.url).searchParams.get("sheetsEdit") === "true"
        ? [
            ...GOOGLE_SCOPES.filter(
              (s) => !s.endsWith("spreadsheets.readonly"),
            ),
            SHEETS_WRITE_SCOPE,
          ]
        : GOOGLE_SCOPES
      ).join(" "),
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    }).toString();
    const response = NextResponse.json(
      { url: url.toString() },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(
      "kimo_google_oauth",
      seal({ owner, state, verifier, issuedAt: Date.now() }),
      {
        httpOnly: true,
        secure: config.origin.startsWith("https:"),
        sameSite: "lax",
        path: "/api/google",
        maxAge: 600,
      },
    );
    return response;
  } catch (error) {
    return routeError(error);
  }
}
