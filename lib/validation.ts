import type { JournalData } from "@/lib/types";

export class ValidationError extends Error {}

function fail(message: string): never {
  throw new ValidationError(message);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${path} muss ein Objekt sein.`);
  }
  return value as Record<string, unknown>;
}

function text(
  value: unknown,
  path: string,
  { max = 500, allowEmpty = false } = {}
) {
  if (typeof value !== "string" || value.length > max || (!allowEmpty && !value.trim())) {
    fail(`${path} ist ungültig.`);
  }
  return value;
}

function finiteNonNegative(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000) {
    fail(`${path} muss eine endliche positive Zahl sein.`);
  }
  return value;
}

function validateCard(value: unknown, path: string) {
  if (value === null) return null;
  const card = record(value, path);
  text(card.id, `${path}.id`, { max: 300 });
  text(card.name, `${path}.name`, { max: 200 });
  text(card.setCode, `${path}.setCode`, { max: 100, allowEmpty: true });
  text(card.setName, `${path}.setName`, { max: 200, allowEmpty: true });
  text(card.number, `${path}.number`, { max: 100, allowEmpty: true });
  text(card.language, `${path}.language`, { max: 20 });
  text(card.source, `${path}.source`, { max: 30 });
  if (typeof card.image !== "string" || card.image.length > 2000) fail(`${path}.image ist ungültig.`);
  if (!Array.isArray(card.attacks) || card.attacks.some((item) => typeof item !== "string")) {
    fail(`${path}.attacks ist ungültig.`);
  }
  if (!Array.isArray(card.abilities) || card.abilities.some((item) => typeof item !== "string")) {
    fail(`${path}.abilities ist ungültig.`);
  }
  finiteNonNegative(card.wishValue, `${path}.wishValue`);
  return card;
}

export function parseJournal(value: unknown): JournalData {
  const journal = record(value, "journal");
  if (journal.version !== 1 || !Array.isArray(journal.albums) || journal.albums.length > 500) {
    fail("Ungültiger Journal-Stand.");
  }
  const albumIds = new Set<string>();
  for (const [albumIndex, albumValue] of journal.albums.entries()) {
    const albumPath = `albums[${albumIndex}]`;
    const album = record(albumValue, albumPath);
    const id = text(album.id, `${albumPath}.id`, { max: 100 });
    if (albumIds.has(id)) fail("Album-IDs müssen eindeutig sein.");
    albumIds.add(id);
    text(album.title, `${albumPath}.title`, { max: 40 });
    text(album.coverColor, `${albumPath}.coverColor`, { max: 20 });
    text(album.innerColor, `${albumPath}.innerColor`, { max: 20 });
    if (!Array.isArray(album.pages) || album.pages.length < 1 || album.pages.length > 500) {
      fail(`${albumPath}.pages ist ungültig.`);
    }
    const pageIds = new Set<string>();
    for (const [pageIndex, pageValue] of album.pages.entries()) {
      const pagePath = `${albumPath}.pages[${pageIndex}]`;
      const page = record(pageValue, pagePath);
      const pageId = text(page.id, `${pagePath}.id`, { max: 100 });
      if (pageIds.has(pageId)) fail("Seiten-IDs müssen innerhalb eines Albums eindeutig sein.");
      pageIds.add(pageId);
      if (!Array.isArray(page.slots) || page.slots.length !== 9) {
        fail(`${pagePath}.slots muss exakt neun Fächer enthalten.`);
      }
      page.slots.forEach((card, slot) => validateCard(card, `${pagePath}.slots[${slot}]`));
    }
  }
  return journal as unknown as JournalData;
}

export function parseCardReference(value: unknown) {
  const card = record(value, "card");
  text(card.id, "card.id", { max: 300 });
  text(card.name, "card.name", { max: 200 });
  text(card.language, "card.language", { max: 20 });
  text(card.source, "card.source", { max: 30 });
  return card;
}
