import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL ist für die Migration erforderlich.");
}

const sql = neon(url);
const migration = await readFile(new URL("../migrations/001_init.sql", import.meta.url), "utf8");
await sql.query(migration);
console.log("PokéJournal-Datenbank ist aktuell.");
