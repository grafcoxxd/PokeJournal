import type { CardCandidate } from "@/lib/types";
import { hammingDistance, perceptualHash } from "@/lib/phash";

const ROOT = "https://pokemon.cardcorpus.com/v1";
const PICTURE_ROOT = "https://img.cardcorpus.com/s1/480";
const responseCache = new Map<string, Promise<unknown>>();

const LANGUAGE_CATALOGS: Record<string, string> = {
  de: "german",
  en: "english",
  fr: "french",
  it: "italian",
  es: "spanish",
  "es-419": "latin-american-spanish",
  pt: "portuguese",
  nl: "dutch",
  pl: "polish",
  ru: "russian",
  ja: "japanese",
  ko: "korean",
  "zh-cn": "zh-hans",
  "zh-tw": "zh-hant",
  th: "thai",
  id: "indonesian"
};

interface CorpusCardPointer {
  set: string;
  id: string;
  name: string;
  englishName?: string;
  number?: { printed?: string; short?: string };
  language: string;
  picture?: { front?: { image?: string } };
}

interface CorpusSpecies {
  dex: number;
  name: string;
  generation: number;
  names: Record<string, string>;
  pictures?: { artwork?: string; home?: string };
}

interface CorpusCard {
  id: string;
  set: string;
  name: string;
  englishName?: string;
  number?: { printed?: string; short?: string };
  language: string;
  rarity?: string;
  credit?: string;
  released?: { date?: string };
  species?: Array<{ id: number; name: string }>;
  picture?: { front?: { image?: string } };
  painting?: { id: string };
}

interface CorpusSet {
  id: string;
  name: string;
  englishName?: string;
  code?: string;
  printedCode?: string;
  language: string;
  released?: { date?: string };
  cards: CorpusCard[];
}

interface CorpusSetSummary {
  id: string;
  name: string;
  englishName?: string;
  code?: string;
  printedCode?: string;
  language: string;
}

interface CorpusPainting {
  id: string;
  cards: Array<Array<{ set: string; id: string }>>;
}

async function corpusJson<T>(path: string): Promise<T> {
  const cached = responseCache.get(path);
  if (cached) return cached as Promise<T>;
  const request = fetch(`${ROOT}/${path}`, {
    cache: "no-store",
    headers: { "user-agent": "PokeJournal/1.0 (GitHub: grafcoxxd/PokeJournal)" }
  }).then(async (response) => {
    if (!response.ok) throw new Error(`CardCorpus ${path}: ${response.status}`);
    return response.json() as Promise<T>;
  });
  responseCache.set(path, request);
  try {
    return await request;
  } catch (error) {
    responseCache.delete(path);
    throw error;
  }
}

function normalized(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\-_]/g, "")
    .replace(/[\u30fc]/g, "");
}

export function normalizeCardNumber(value: string) {
  const [numerator] = value.trim().toLowerCase().split("/");
  return numerator.replace(/^0+(?=\d)/, "");
}

function pictureUrl(id?: string) {
  return id ? `${PICTURE_ROOT}/${id}.avif` : "";
}

function appLanguage(value: string) {
  if (value === "zh-Hans") return "zh-cn";
  if (value === "zh-Hant") return "zh-tw";
  return value;
}

export function baseCardName(value: string) {
  return value.replace(/\s+(ex|EX|V|VMAX|VSTAR|GX|δ)$/i, "").trim();
}

function pointerToCard(
  pointer: CorpusCardPointer,
  set?: CorpusSetSummary
): CardCandidate {
  return {
    id: `cardcorpus:${pointer.set}:${pointer.id}`,
    source: "cardcorpus",
    name: pointer.name,
    baseName: baseCardName(pointer.englishName ?? pointer.name),
    setCode: set?.printedCode ?? set?.code ?? pointer.set.split("/").pop() ?? "",
    setName: set?.name ?? set?.englishName ?? pointer.set,
    number: pointer.number?.printed ?? pointer.number?.short ?? pointer.id,
    language: appLanguage(pointer.language),
    image: pictureUrl(pointer.picture?.front?.image),
    attacks: [],
    abilities: [],
    corpusSet: pointer.set,
    corpusCard: pointer.id
  };
}

function detailToCandidate(set: CorpusSet, card: CorpusCard): CardCandidate {
  return {
    ...pointerToCard({
      set: card.set,
      id: card.id,
      name: card.name,
      englishName: card.englishName,
      number: card.number,
      language: card.language,
      picture: card.picture
    }, set),
    pokedexId: card.species?.[0]?.id,
    illustrator: card.credit,
    rarity: card.rarity,
    releaseDate: card.released?.date ?? set.released?.date
  };
}

export async function cardCorpusSpecies() {
  const data = await corpusJson<{ species: CorpusSpecies[] }>("pokemon.json");
  return data.species;
}

async function catalogData(language: string) {
  const catalog = LANGUAGE_CATALOGS[language];
  if (!catalog) return null;
  const [cards, sets] = await Promise.all([
    corpusJson<{ cards: CorpusCardPointer[] }>(`cards/${catalog}.json`),
    corpusJson<{ sets: CorpusSetSummary[] }>(`sets/${catalog}.json`)
  ]);
  return {
    cards: cards.cards,
    sets: new Map(sets.sets.map((set) => [set.id, set]))
  };
}

export async function searchCardCorpus(
  query: string,
  languages: string[],
  setCode?: string,
  number?: string
) {
  const normalizedQuery = normalized(query);
  const normalizedSet = normalized(setCode ?? "");
  const normalizedNumber = normalizeCardNumber(number ?? "");
  const batches = await Promise.allSettled(
    languages.map(async (language) => {
      const catalog = await catalogData(language);
      if (!catalog) return [];
      return catalog.cards.filter((card) => {
        const set = catalog.sets.get(card.set);
        if (normalizedSet) {
          const candidates = [
            set?.printedCode,
            set?.code,
            set?.id,
            set?.name,
            set?.englishName
          ].filter(Boolean) as string[];
          if (!candidates.some((value) => normalized(value) === normalizedSet)) return false;
        }
        if (normalizedNumber) {
          const candidateNumber = normalizeCardNumber(
            card.number?.short ?? card.number?.printed ?? card.id
          );
          if (candidateNumber !== normalizedNumber) return false;
        }
        if (!normalizedNumber && normalizedQuery) {
          const names = [card.name, card.englishName ?? ""];
          if (!names.some((name) => normalized(name).includes(normalizedQuery))) return false;
        }
        return true;
      }).slice(0, 150).map((card) => pointerToCard(card, catalog.sets.get(card.set)));
    })
  );
  return batches.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

export async function findCardCorpusByCard(reference: CardCandidate) {
  if (reference.corpusSet && reference.corpusCard) {
    return { set: reference.corpusSet, card: reference.corpusCard };
  }
  const languages = LANGUAGE_CATALOGS[reference.language]
    ? [reference.language]
    : ["en"];
  const candidates = await searchCardCorpus(
    reference.baseName ?? reference.name,
    languages,
    reference.setCode,
    reference.number
  );
  const exact = candidates.find((candidate) =>
    normalizeCardNumber(candidate.number) === normalizeCardNumber(reference.number) &&
    normalized(candidate.setCode) === normalized(reference.setCode)
  );
  if (exact) return { set: exact.corpusSet!, card: exact.corpusCard! };
  if (candidates.length === 1) {
    return { set: candidates[0].corpusSet!, card: candidates[0].corpusCard! };
  }
  if (!reference.image) return undefined;
  try {
    const sourceHash = await perceptualHash(reference.image);
    const ranked = await Promise.allSettled(
      candidates.slice(0, 40).map(async (candidate) => ({
        candidate,
        distance: candidate.image
          ? hammingDistance(sourceHash, await perceptualHash(candidate.image))
          : 65
      }))
    );
    const best = ranked
      .flatMap((result) => result.status === "fulfilled" ? [result.value] : [])
      .sort((left, right) => left.distance - right.distance)[0];
    return best && best.distance <= 18
      ? { set: best.candidate.corpusSet!, card: best.candidate.corpusCard! }
      : undefined;
  } catch {
    return undefined;
  }
}

export async function cardCorpusCounterparts(reference: CardCandidate) {
  const pointer = await findCardCorpusByCard(reference);
  if (!pointer) return [];
  const sourceSet = await corpusJson<CorpusSet>(`sets/${pointer.set}.json`);
  const sourceCard = sourceSet.cards.find((card) => card.id === pointer.card);
  if (!sourceCard) return [];
  const paintingId = sourceCard.painting?.id;
  const family = paintingId
    ? await corpusJson<CorpusPainting>(`paintings/${paintingId}.json`)
    : { id: "", cards: [[{ set: sourceSet.id, id: sourceCard.id }]] };
  const pointers = family.cards.flat().filter(
    (item) => item.set !== sourceSet.id || item.id !== sourceCard.id
  );
  const results = await Promise.allSettled(
    pointers.map(async (item) => {
      const targetSet = await corpusJson<CorpusSet>(`sets/${item.set}.json`);
      const targetCard = targetSet.cards.find((card) => card.id === item.id);
      if (!targetCard) return null;
      return {
        ...detailToCandidate(targetSet, targetCard),
        score: 1,
        matchReason: ["Gleiche CardCorpus-Artworkfamilie"],
        canonicalCardId: `cardcorpus:painting:${paintingId}`
      };
    })
  );
  return results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : []
  );
}

export async function localizedCorpusNames(query: string) {
  if (!query.trim()) return [];
  const species = await cardCorpusSpecies();
  const needle = normalized(baseCardName(query));
  return species
    .filter((pokemon) =>
      Object.values(pokemon.names).some((name) => normalized(name) === needle)
    )
    .map((pokemon) => pokemon);
}
