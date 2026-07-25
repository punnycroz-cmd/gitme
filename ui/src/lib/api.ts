// TinyHub — shared API helpers for App Router route handlers.

import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "./rate-limit";
import { checkAuth } from "./security";
import { DEFAULT_USER } from "./config";
import { safeJsonParse } from "./helpers";

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      ...extra,
    },
  });

export const apiError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

/// Apply rate limiting. `cost` = tokens to consume.
export function applyRateLimit(req: NextRequest, cost = 1): NextResponse | null {
  const ip = clientIp(req);
  const res = rateLimit(`${ip}:${req.method}`, cost);
  if (!res.success) {
    return NextResponse.json(
      { error: "Too Many Requests", retryAfter: res.retryAfter },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(res.retryAfter / 1000)) },
      }
    );
  }
  return null;
}

/// Require write auth. Returns null if OK, else an error Response.
export function requireWriteAuth(req: NextRequest): NextResponse | null {
  const auth = checkAuth(req);
  if (!auth.ok) {
    return apiError("Unauthorized: invalid token", 401);
  }
  return null;
}

/// CORS preflight handler.
export function handleOptions(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
    },
  });
}

export { DEFAULT_USER, safeJsonParse };
