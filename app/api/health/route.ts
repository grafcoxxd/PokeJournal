import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, storage: "unavailable" }, { status: 503 });
  }
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`SELECT 1`;
    return NextResponse.json({ ok: true, storage: "neon" });
  } catch {
    return NextResponse.json({ ok: false, storage: "unavailable" }, { status: 503 });
  }
}
