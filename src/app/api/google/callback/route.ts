import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  googleConfig,
  googleTokenRequest,
  adminClient,
  getConnection,
} from "@/integrations/google/server";
import { seal, unseal } from "@/integrations/google/crypto";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  let config;
  try {
    config = googleConfig();
  } catch {
    return new Response("Google connection is not configured.", {
      status: 503,
    });
  }
  let outcome = "failed";
  try {
    const cookie = request.cookies.get("kimo_google_oauth")?.value;
    if (!cookie) throw new Error("Missing state");
    const state = unseal<{
      owner: string;
      state: string;
      verifier: string;
      issuedAt: number;
    }>(cookie);
    const received = request.nextUrl.searchParams.get("state") ?? "";
    const a = Buffer.from(state.state);
    const b = Buffer.from(received);
    if (
      a.length !== b.length ||
      !timingSafeEqual(a, b) ||
      Date.now() - state.issuedAt > 600000 ||
      state.issuedAt > Date.now()
    )
      throw new Error("Invalid state");
    if (request.nextUrl.searchParams.has("error"))
      throw new Error("Consent denied");
    const code = request.nextUrl.searchParams.get("code");
    if (!code) throw new Error("Missing code");
    const tokens = await googleTokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      code_verifier: state.verifier,
    });
    const identityResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      },
    );
    if (!identityResponse.ok) throw new Error("Identity unavailable");
    const identity = (await identityResponse.json()) as {
      email: string;
      email_verified: boolean;
    };
    if (!identity.email || !identity.email_verified)
      throw new Error("Unverified account");
    const previous = await getConnection(state.owner);
    let refresh = tokens.refresh_token;
    if (!refresh && previous?.email === identity.email)
      refresh = unseal<{ refreshToken: string }>(
        previous.credentials,
      ).refreshToken;
    if (!refresh) throw new Error("Offline access required");
    const { error } = await adminClient()
      .from("google_connections")
      .upsert({
        owner_id: state.owner,
        email: identity.email,
        scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
        credentials: seal({
          accessToken: tokens.access_token,
          refreshToken: refresh,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        }),
        snapshot: previous?.email === identity.email ? previous.snapshot : null,
        last_synced_at:
          previous?.email === identity.email ? previous.last_synced_at : null,
      });
    if (error) throw new Error("Save failed");
    outcome = "connected";
  } catch {}
  const response = NextResponse.redirect(
    `${config.origin}/?google=${outcome}#settings`,
  );
  response.cookies.set("kimo_google_oauth", "", {
    httpOnly: true,
    path: "/api/google",
    maxAge: 0,
    secure: config.origin.startsWith("https:"),
    sameSite: "lax",
  });
  return response;
}
