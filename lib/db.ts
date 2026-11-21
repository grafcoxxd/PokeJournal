import { neon } from "@neondatabase/serverless";
import type { JournalData } from "@/lib/types";
import { EMPTY_JOURNAL } from "@/lib/types";

function connection() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ist nicht konfiguriert.");
  return neon(url);
}

export async function loadJournal(ownerHash: string) {
  const sql = connection();
  const rows = await sql`
    SELECT data, updated_at
    FROM journals
    WHERE owner_hash = ${ownerHash}
    LIMIT 1
  `;
  const row = rows[0] as { data?: JournalData; updated_at?: Date } | undefined;
  if (!row) {
    return { data: EMPTY_JOURNAL, updatedAt: undefined };
  }
  return { data: row.data ?? EMPTY_JOURNAL, updatedAt: row.updated_at?.toISOString?.() };
}

export async function saveJournal(ownerHash: string, data: JournalData) {
  const sql = connection();
  const rows = await sql`
    INSERT INTO journals (owner_hash, data, updated_at)
    VALUES (${ownerHash}, ${JSON.stringify(data)}::jsonb, NOW())
    ON CONFLICT (owner_hash) DO UPDATE
    SET data = EXCLUDED.data, updated_at = NOW()
    RETURNING updated_at
  `;
  return (rows[0] as { updated_at: Date }).updated_at.toISOString();
}
