/**
 * OAuth "Login with Azava" for internal team tools.
 *
 * Provides user identity (userId, teamId) via session cookies.
 * Does NOT grant API access — data queries still use the workspace AZAVA_API_KEY.
 *
 * Usage:
 *   import { setupAuth, requireAuth, getUser } from "../lib/auth.js";
 *   setupAuth(server);
 *
 * Then in query handlers:
 *   const user = await requireAuth(req, res); // redirects if not logged in
 *   const user = getUser(req);                // returns null if not logged in
 */

import { createHmac, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import type { IncomingMessage, ServerResponse, Server } from "node:http";

// ── Types ──

export interface AuthUser {
  userId: string;
  teamId: string;
}

interface SessionPayload {
  sub: string;
  team_id: string;
  exp: number;
}

// ── Config ──

const SESSION_COOKIE = "azava_session";
const PKCE_COOKIE = "azava_pkce";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is required for auth");
  return secret;
}

function getOAuthConfig() {
  const clientId = process.env.AZAVA_OAUTH_CLIENT_ID;
  const clientSecret = process.env.AZAVA_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "AZAVA_OAUTH_CLIENT_ID and AZAVA_OAUTH_CLIENT_SECRET are required. Run: npm run register <deployment-url>",
    );
  }
  return { clientId, clientSecret };
}

// ── Cookie helpers ──

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie ?? "";
  const cookies: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name) cookies[name] = decodeURIComponent(rest.join("="));
  }
  return cookies;
}

function setCookie(res: ServerResponse, name: string, value: string, maxAge: number) {
  const isSecure = config.AZAVA_API_URL.startsWith("https");
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=${maxAge}`];
  if (isSecure) parts.push("Secure");

  const existing = (res.getHeader("Set-Cookie") as string[] | string | undefined) ?? [];
  const all = Array.isArray(existing) ? existing : existing ? [existing] : [];
  all.push(parts.join("; "));
  res.setHeader("Set-Cookie", all);
}

function clearCookie(res: ServerResponse, name: string) {
  setCookie(res, name, "", 0);
}

// ── Session signing ──

function signSession(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = createHmac("sha256", getSessionSecret()).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

function verifySession(token: string): SessionPayload | null {
  const dot = token.indexOf(".");
  if (dot === -1) return null;

  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = createHmac("sha256", getSessionSecret()).update(b64).digest("base64url");
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── PKCE ──

function generatePKCE() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// ── Public API ──

/**
 * Returns the authenticated user from the session cookie, or null.
 * Does not redirect — use this for optional auth context.
 */
export function getUser(req: IncomingMessage): AuthUser | null {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const payload = verifySession(token);
  if (!payload) return null;

  return { userId: payload.sub, teamId: payload.team_id };
}

/**
 * Returns the authenticated user, or sends a redirect to /auth/login.
 * Returns null if redirected (caller should return early).
 */
export function requireAuth(req: IncomingMessage, res: ServerResponse): AuthUser | null {
  const user = getUser(req);
  if (user) return user;

  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.writeHead(302, { Location: `/auth/login?returnUrl=${encodeURIComponent(url.pathname + url.search)}` });
  res.end();
  return null;
}

/**
 * Wire auth routes into the HTTP server. Call this once at startup.
 * Handles: GET /auth/login, GET /auth/callback, GET /auth/logout
 */
export function setupAuth(server: Server) {
  const originalListeners = server.listeners("request") as Array<
    (req: IncomingMessage, res: ServerResponse) => void
  >;
  server.removeAllListeners("request");

  // Validate config eagerly at startup
  getOAuthConfig();
  getSessionSecret();

  server.on("request", async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url!, `http://localhost`);

    if (url.pathname === "/auth/login") {
      handleLogin(req, res);
      return;
    }

    if (url.pathname === "/auth/callback") {
      await handleCallback(req, res);
      return;
    }

    if (url.pathname === "/auth/logout") {
      clearCookie(res, SESSION_COOKIE);
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    // Global auth gate — all other routes require a valid session
    const user = getUser(req);
    if (!user) {
      const returnUrl = url.pathname + url.search;
      res.writeHead(302, { Location: `/auth/login?returnUrl=${encodeURIComponent(returnUrl)}` });
      res.end();
      return;
    }

    // Pass through to original handler
    for (const listener of originalListeners) {
      listener(req, res);
    }
  });
}

// ── Route handlers ──

function handleLogin(req: IncomingMessage, res: ServerResponse) {
  const { clientId } = getOAuthConfig();
  const { verifier, challenge } = generatePKCE();
  const state = randomBytes(16).toString("hex");

  // Preserve the URL the user was trying to reach
  const loginUrl = new URL(req.url!, `http://localhost`);
  const returnUrl = loginUrl.searchParams.get("returnUrl") ?? "/";

  // Determine callback URL from the incoming request
  const host = req.headers.host ?? "localhost:3000";
  const proto = req.headers["x-forwarded-proto"] ?? "http";
  const callbackUrl = `${proto}://${host}/auth/callback`;

  // Store verifier, state, and returnUrl in a short-lived cookie
  setCookie(res, PKCE_COOKIE, JSON.stringify({ verifier, state, returnUrl }), 600);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  res.writeHead(302, { Location: `${config.AZAVA_API_URL}/oauth/cs/authorize?${params}` });
  res.end();
}

async function handleCallback(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, `http://localhost`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Missing authorization code");
    return;
  }

  // Verify state
  const cookies = parseCookies(req);
  const pkceCookie = cookies[PKCE_COOKIE];
  if (!pkceCookie) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Missing PKCE cookie — try logging in again");
    return;
  }

  let pkceData: { verifier: string; state: string; returnUrl?: string };
  try {
    pkceData = JSON.parse(pkceCookie);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Invalid PKCE cookie");
    return;
  }

  if (state !== pkceData.state) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("State mismatch — possible CSRF attack");
    return;
  }

  // Clear PKCE cookie
  clearCookie(res, PKCE_COOKIE);

  // Exchange code for token (server-to-server)
  const { clientId, clientSecret } = getOAuthConfig();
  const host = req.headers.host ?? "localhost:3000";
  const proto = req.headers["x-forwarded-proto"] ?? "http";
  const callbackUrl = `${proto}://${host}/auth/callback`;

  const tokenRes = await fetch(`${config.AZAVA_API_URL}/oauth/cs/token`, {
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
    const err = await tokenRes.text();
    console.error("[auth] Token exchange failed:", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Authentication failed — please try again");
    return;
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Decode the JWT payload (we trust it — it came from our platform over HTTPS)
  const payloadB64 = access_token.split(".")[1];
  const jwtPayload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as {
    sub: string;
    team_id: string;
  };

  // Create session cookie
  const session: SessionPayload = {
    sub: jwtPayload.sub,
    team_id: jwtPayload.team_id,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };

  setCookie(res, SESSION_COOKIE, signSession(session), SESSION_MAX_AGE);
  res.writeHead(302, { Location: pkceData.returnUrl ?? "/" });
  res.end();
}
