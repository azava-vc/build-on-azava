import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { generatePKCE, PKCE_COOKIE } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const clientId = process.env.AZAVA_OAUTH_CLIENT_ID;
  const azavaUrl = process.env.AZAVA_API_URL?.replace(/\/$/, "");

  if (!clientId || !azavaUrl) {
    return new NextResponse("Auth is not configured", { status: 500 });
  }

  const { verifier, challenge } = generatePKCE();
  const state = randomBytes(16).toString("hex");

  const returnUrl = request.nextUrl.searchParams.get("returnUrl") ?? "/";

  // Build callback URL from the incoming request
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const callbackUrl = `${proto}://${host}/auth/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  const response = NextResponse.redirect(`${azavaUrl}/oauth/cs/authorize?${params}`);

  // Store PKCE verifier, state, and returnUrl in a short-lived cookie
  response.cookies.set(PKCE_COOKIE, JSON.stringify({ verifier, state, returnUrl }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: azavaUrl.startsWith("https"),
  });

  return response;
}
