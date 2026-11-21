import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL ist für die Migration erforderlich.");
}

const sql = neon(url);
const migration = await readFile(new URL("../migrations/001_init.sql", import.meta.url), "utf8");
const statements = migration
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}
console.log("PokéJournal-Datenbank ist aktuell.");
