import { createHash, randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "pj_fallback";

function isPrivateOrLoopback(address: string) {
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address.startsWith("10.") ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address) ||
    address.startsWith("fc") ||
    address.startsWith("fd") ||
    address.startsWith("fe80:")
  );
}

export function identityForRequest(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const connecting = request.headers.get("cf-connecting-ip")?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const address = connecting || realIp || forwarded || "unknown";
  const localFallback = request.cookies.get(COOKIE_NAME)?.value || randomUUID();
  const secret = process.env.IDENTITY_SECRET;

  if (!secret) {
    throw new Error("IDENTITY_SECRET fehlt. Konfiguriere die Variable vor Produktionsbetrieb.");
  }

  const source =
    address === "unknown" || isPrivateOrLoopback(address)
      ? `fallback:${localFallback}`
      : `ip:${address}`;
  const ownerHash = createHash("sha256")
    .update(`${secret}:${source}`)
    .digest("hex");

  return { ownerHash, fallbackCookie: localFallback, usesFallback: source.startsWith("fallback:") };
}

export function attachIdentityCookie(
  response: NextResponse,
  identity: ReturnType<typeof identityForRequest>
) {
  if (identity.usesFallback) {
    response.cookies.set(COOKIE_NAME, identity.fallbackCookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365 * 2,
      path: "/"
    });
  }
  return response;
}
