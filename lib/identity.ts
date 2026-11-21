import { createHash, randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "pj_device";
const LEGACY_COOKIE_NAME = "pj_fallback";

export function identityForRequest(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const connecting = request.headers.get("cf-connecting-ip")?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const address = connecting || realIp || forwarded || "unknown";
  const existingDeviceId =
    request.cookies.get(COOKIE_NAME)?.value ??
    request.cookies.get(LEGACY_COOKIE_NAME)?.value;
  const deviceId = existingDeviceId || randomUUID();
  const secret = process.env.IDENTITY_SECRET;

  if (!secret) {
    throw new Error("IDENTITY_SECRET fehlt. Konfiguriere die Variable vor Produktionsbetrieb.");
  }

  const ownerHash = createHash("sha256")
    .update(`${secret}:device:${deviceId}`)
    .digest("hex");
  const legacyOwnerHash = createHash("sha256")
    .update(`${secret}:${existingDeviceId ? `fallback:${existingDeviceId}` : `ip:${address}`}`)
    .digest("hex");

  return { ownerHash, legacyOwnerHash, deviceId };
}

export function attachIdentityCookie(
  response: NextResponse,
  identity: ReturnType<typeof identityForRequest>
) {
  response.cookies.set(COOKIE_NAME, identity.deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365 * 5,
    path: "/"
  });
  response.cookies.delete(LEGACY_COOKIE_NAME);
  return response;
}
