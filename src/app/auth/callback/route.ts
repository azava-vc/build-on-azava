import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, PKCE_COOKIE, signSession, sessionMaxAge } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const azavaUrl = process.env.AZAVA_API_URL?.replace(/\/$/, "");
  const clientId = process.env.AZAVA_OAUTH_CLIENT_ID;
  const clientSecret = process.env.AZAVA_OAUTH_CLIENT_SECRET;

  if (!azavaUrl || !clientId || !clientSecret) {
    return new NextResponse("Auth is not configured", { status: 500 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) {
    return new NextResponse("Missing authorization code", { status: 400 });
  }

  // Verify state from PKCE cookie
  const pkceCookie = request.cookies.get(PKCE_COOKIE);
  if (!pkceCookie) {
    return new NextResponse("Missing PKCE cookie — try logging in again", { status: 400 });
  }

  let pkceData: { verifier: string; state: string; returnUrl?: string };
  try {
    pkceData = JSON.parse(pkceCookie.value);
  } catch {
    return new NextResponse("Invalid PKCE cookie", { status: 400 });
  }

  if (state !== pkceData.state) {
    return new NextResponse("State mismatch — possible CSRF attack", { status: 400 });
  }

  // Build callback URL (must match what was sent in the authorize request)
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const callbackUrl = `${proto}://${host}/auth/callback`;

  // Exchange code for token (server-to-server)
  const tokenRes = await fetch(`${azavaUrl}/oauth/cs/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      code_verifier: pkceData.verifier,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    console.error("[auth] Token exchange failed:", tokenRes.status, body);
    return new NextResponse("Authentication failed — please try again", { status: 500 });
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Decode JWT payload (trusted — came from our platform over HTTPS)
  const payloadB64 = access_token.split(".")[1];
  const jwtPayload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as {
    sub: string;
    team_id: string;
  };

  const maxAge = sessionMaxAge();
  const session = signSession({
    sub: jwtPayload.sub,
    team_id: jwtPayload.team_id,
    exp: Math.floor(Date.now() / 1000) + maxAge,
  });

  const returnUrl = pkceData.returnUrl ?? "/";
  const response = NextResponse.redirect(new URL(returnUrl, request.url));

  response.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: azavaUrl.startsWith("https"),
  });

  // Clear PKCE cookie
  response.cookies.delete(PKCE_COOKIE);

  return response;
}
