import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, PKCE_COOKIE } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const baseUrl = (process.env.BASE_URL ?? request.nextUrl.origin).replace(/\/$/, "");
  const response = NextResponse.redirect(new URL("/", baseUrl));
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(PKCE_COOKIE);
  return response;
}
