/**
 * OAuth "Login with Azava" for internal team tools.
 *
 * Provides user identity (userId, teamId) via session cookies.
 * Does NOT grant API access — data queries still use the workspace AZAVA_API_KEY.
 *
 * Usage in server components:
 *   import { getUser } from "@/lib/auth";
 *   const user = await getUser(); // { userId, teamId } or null
 *
 * The auth gate is handled by middleware.ts — if auth env vars are set,
 * all routes except /auth/* require a valid session.
 */

import { createHmac, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

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

// ── Constants ──

export const SESSION_COOKIE = "azava_session";
export const PKCE_COOKIE = "azava_pkce";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

// ── Public API ──

/**
 * Get the authenticated user from the session cookie.
 * Call this in server components or route handlers.
 * Returns null if not authenticated or auth is not configured.
 */
export async function getUser(): Promise<AuthUser | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session) return null;

  const payload = verifySession(session.value, secret);
  if (!payload) return null;

  return { userId: payload.sub, teamId: payload.team_id };
}

/**
 * Check if auth is configured (OAuth env vars are set).
 * Used by middleware to decide whether to enforce the auth gate.
 */
export function isAuthEnabled(): boolean {
  return !!(
    process.env.AZAVA_OAUTH_CLIENT_ID &&
    process.env.AZAVA_OAUTH_CLIENT_SECRET &&
    process.env.SESSION_SECRET
  );
}

// ── Session helpers (exported for use in route handlers) ──

export function signSession(payload: SessionPayload): string {
  const secret = process.env.SESSION_SECRET!;
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = createHmac("sha256", secret).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

export function verifySession(token: string, secret: string): SessionPayload | null {
  const dot = token.indexOf(".");
  if (dot === -1) return null;

  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = createHmac("sha256", secret).update(b64).digest("base64url");

  // Timing-safe comparison — buffers must be same length
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generatePKCE() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function sessionMaxAge() {
  return SESSION_MAX_AGE;
}
