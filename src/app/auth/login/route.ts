import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { generatePKCE, PKCE_COOKIE } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const clientId = process.env.AZAVA_OAUTH_CLIENT_ID;
  const appUrl = (process.env.AZAVA_APP_URL ?? "https://app.azava.com").replace(/\/$/, "");

  if (!clientId) {
    return new NextResponse("Auth is not configured", { status: 500 });
  }

  const { verifier, challenge } = generatePKCE();
  const state = randomBytes(16).toString("hex");

  const returnUrl = request.nextUrl.searchParams.get("returnUrl") ?? "/";

  // Build callback URL — BASE_URL is required behind reverse proxies (e.g. Render)
  const baseUrl = (process.env.BASE_URL ?? request.nextUrl.origin).replace(/\/$/, "");
  const callbackUrl = `${baseUrl}/auth/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  const response = NextResponse.redirect(`${appUrl}/oauth/cs/authorize?${params}`);

  // Store PKCE verifier, state, and returnUrl in a short-lived cookie
  response.cookies.set(PKCE_COOKIE, JSON.stringify({ verifier, state, returnUrl }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: baseUrl.startsWith("https"),
  });

  return response;
}
