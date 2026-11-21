import { NextRequest, NextResponse } from "next/server";
import { attachIdentityCookie, identityForRequest } from "@/lib/identity";
import { loadJournal, saveJournal } from "@/lib/db";
import { parseJournal, ValidationError } from "@/lib/validation";

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL || !process.env.IDENTITY_SECRET) {
    return NextResponse.json(
      { connected: false, storage: "unavailable", message: "Demo-Speicher – Neon nicht konfiguriert" },
      { status: 503 }
    );
  }
  try {
    const identity = identityForRequest(request);
    const journal = await loadJournal(identity.ownerHash);
    return attachIdentityCookie(
      NextResponse.json({ ...journal, connected: true, storage: "neon" }),
      identity
    );
  } catch (error) {
    console.error("Journal laden:", error);
    return NextResponse.json(
      { connected: false, storage: "unavailable", message: "Speicherung ist nicht verfügbar." },
      { status: 503 }
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!process.env.DATABASE_URL || !process.env.IDENTITY_SECRET) {
    return NextResponse.json(
      { connected: false, storage: "unavailable", message: "Neon ist nicht konfiguriert." },
      { status: 503 }
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "JSON-Body ist ungültig." }, { status: 400 });
  }
  try {
    const data = parseJournal(body);
    const identity = identityForRequest(request);
    const updatedAt = await saveJournal(identity.ownerHash, data);
    return attachIdentityCookie(
      NextResponse.json({ connected: true, storage: "neon", updatedAt }),
      identity
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error("Journal speichern:", error);
    return NextResponse.json(
      { connected: false, storage: "unavailable", message: "Speichern fehlgeschlagen." },
      { status: 503 }
    );
  }
}
