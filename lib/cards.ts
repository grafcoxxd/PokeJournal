import type { CardCandidate } from "@/lib/types";
import { hammingDistance, perceptualHash } from "@/lib/phash";
import {
  cardCorpusCounterparts,
  normalizeCardNumber,
  localizedCorpusNames,
  searchCardCorpus
} from "@/lib/cardcorpus";

type UnknownRecord = Record<string, unknown>;

const TCGDEX_LANGUAGES = [
  "de", "en", "fr", "it", "es", "pt", "nl", "pl", "ja", "ko",
  "es-419", "zh-cn", "zh-tw", "th", "id"
];

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function baseCardName(value: string) {
  return value
    .replace(/\s+(ex|EX|V|VMAX|VSTAR|GX|δ)$/i, "")
    .trim();
}

function imageUrl(value: unknown) {
  if (typeof value === "string") {
    if (/\.(webp|png|jpe?g)$/i.test(value)) return value;
    return `${value.replace(/\/$/, "")}/high.webp`;
  }
  if (value && typeof value === "object") {
    const image = value as UnknownRecord;
    return stringValue(image.large) || stringValue(image.small) || stringValue(image.url);
  }
  return "";
}

function normalizeTcgdex(item: UnknownRecord, language: string): CardCandidate | null {
  const id = stringValue(item.id);
  const set = (item.set ?? {}) as UnknownRecord;
  if (!id || !stringValue(item.name)) return null;
  const legalNumber = item.localId ?? item.number;
  const dexId = Array.isArray(item.dexId) ? item.dexId[0] : item.dexId;
  const attacks = Array.isArray(item.attacks)
    ? item.attacks.map((attack) => stringValue((attack as UnknownRecord).name)).filter(Boolean)
    : [];
  const abilities = Array.isArray(item.abilities)
    ? item.abilities.map((ability) => stringValue((ability as UnknownRecord).name)).filter(Boolean)
    : [];
  const inferredSetCode = id.includes("-") ? id.slice(0, id.lastIndexOf("-")) : "";
  return {
    id: `tcgdex:${language}:${id}`,
    source: "tcgdex",
    name: stringValue(item.name),
    baseName: baseCardName(stringValue(item.baseName, stringValue(item.name))),
    setCode: stringValue(item.setCode, stringValue(set.id, inferredSetCode)),
    setName: stringValue(item.setName, stringValue(set.name)),
    number: stringValue(legalNumber),
    language,
    image: imageUrl(item.image),
    hp: numberValue(item.hp),
    pokedexId: numberValue(dexId),
    illustrator: stringValue(item.illustrator),
    rarity: stringValue(item.rarity),
    attacks,
    abilities,
    releaseDate: stringValue(item.releaseDate)
  };
}

export async function hydrateTcgdexCard(card: CardCandidate) {
  if (card.source !== "tcgdex") return card;
  const parts = card.id.split(":");
  const language = parts[1] || card.language;
  const externalId = parts.slice(2).join(":");
  if (!language || !externalId) return card;
  try {
    const detail = (await fetchJson(
      `https://api.tcgdex.net/v2/${language}/cards/${encodeURIComponent(externalId)}`
    )) as UnknownRecord;
    return { ...card, ...(normalizeTcgdex(detail, language) ?? card) };
  } catch {
    return card;
  }
}

function normalizePokemonTcg(item: UnknownRecord): CardCandidate | null {
  const id = stringValue(item.id);
  if (!id) return null;
  const set = (item.set ?? {}) as UnknownRecord;
  const nationalPokedexNumbers = item.nationalPokedexNumbers;
  return {
    id: `pokemontcg:${id}`,
    source: "pokemontcg",
    name: stringValue(item.name),
    baseName: stringValue(item.evolvesFrom)
      ? stringValue(item.name)
      : stringValue(item.name).replace(/\s+(ex|V|VMAX|VSTAR|GX)$/i, ""),
    setCode: stringValue(set.id),
    setName: stringValue(set.name),
    number: stringValue(item.number),
    language: "en",
    image: imageUrl(item.images),
    hp: numberValue(item.hp),
    pokedexId: Array.isArray(nationalPokedexNumbers)
      ? numberValue(nationalPokedexNumbers[0])
      : undefined,
    illustrator: stringValue(item.artist),
    rarity: stringValue(item.rarity),
    attacks: Array.isArray(item.attacks)
      ? item.attacks.map((attack) => stringValue((attack as UnknownRecord).name)).filter(Boolean)
      : [],
    abilities: Array.isArray(item.abilities)
      ? item.abilities.map((ability) => stringValue((ability as UnknownRecord).name)).filter(Boolean)
      : [],
    releaseDate: stringValue(set.releaseDate)
  };
}

function normalizeCardCorpse(item: UnknownRecord): CardCandidate | null {
  const id = stringValue(item.id) || stringValue(item.uuid);
  if (!id) return null;
  return {
    id: `cardcorpse:${id}`,
    source: "cardcorpse",
    name: stringValue(item.name),
    baseName: stringValue(item.baseName, stringValue(item.name)),
    setCode: stringValue(item.setCode),
    setName: stringValue(item.setName),
    number: stringValue(item.number),
    language: stringValue(item.language, "unknown"),
    image: imageUrl(item.image ?? item.imageUrl ?? item.images),
    hp: numberValue(item.hp),
    pokedexId: numberValue(item.pokedexId),
    illustrator: stringValue(item.illustrator ?? item.artist),
    rarity: stringValue(item.rarity),
    attacks: Array.isArray(item.attacks) ? item.attacks.map(String) : [],
    abilities: Array.isArray(item.abilities) ? item.abilities.map(String) : [],
    releaseDate: stringValue(item.releaseDate)
  };
}

async function fetchJson(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    headers: { accept: "application/json", ...headers },
    next: { revalidate: 3600 }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function searchTcgdex(
  query: string,
  languages: string[],
  setCode?: string,
  number?: string,
  hydrate = false
) {
  const jobs = languages.filter((language) => TCGDEX_LANGUAGES.includes(language)).map(async (language) => {
    const providerLanguage = language === "zh-tw" ? "zh-hant" : language;
    const url = new URL(`https://api.tcgdex.net/v2/${providerLanguage}/cards`);
    if (query) url.searchParams.set("name", query);
    if (setCode) url.searchParams.set("set", setCode);
    const data = await fetchJson(url.toString());
    const items = Array.isArray(data) ? data : data.data ?? [];
    const summaries = (items as UnknownRecord[])
      .map((item) => normalizeTcgdex(item, language))
      .filter((item): item is CardCandidate => Boolean(item))
      .filter((item) =>
        !setCode || normalizedSetCode(item.setCode) === normalizedSetCode(setCode)
      )
      .filter((item) =>
        !number || normalizeCardNumber(item.number) === normalizeCardNumber(number)
      );
    const hydrateLimit = hydrate ? 40 : 24;
    const cardsToHydrate = summaries.slice(0, hydrateLimit);
    const detailById = new Map<string, CardCandidate>();
    await Promise.allSettled(
      cardsToHydrate.map(async (summary) => {
        const externalId = summary.id.split(":").slice(2).join(":");
        const item = (await fetchJson(
          `https://api.tcgdex.net/v2/${providerLanguage}/cards/${encodeURIComponent(externalId)}`
        )) as UnknownRecord;
        const detail = normalizeTcgdex(item, language) ?? summary;
        detailById.set(summary.id, detail);
        return detail;
      })
    );
    return summaries.slice(0, hydrateLimit).map(
      (summary) => detailById.get(summary.id) ?? summary
    ).concat(summaries.slice(hydrateLimit));
  });
  return (await Promise.allSettled(jobs)).flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );
}

async function searchPokemonTcg(query: string, setCode?: string, number?: string) {
  const clauses: string[] = [];
  if (query) clauses.push(`name:"${query.replace(/"/g, "")}*"`);
  if (setCode) clauses.push(`set.id:${setCode}`);
  if (number) clauses.push(`number:${number}`);
  const url = new URL("https://api.pokemontcg.io/v2/cards");
  url.searchParams.set("q", clauses.join(" "));
  url.searchParams.set("pageSize", "50");
  const headers: Record<string, string> = {};
  if (process.env.POKEMON_TCG_API_KEY) {
    headers["X-Api-Key"] = process.env.POKEMON_TCG_API_KEY;
  }
  const data = await fetchJson(url.toString(), headers);
  return ((data.data ?? []) as UnknownRecord[])
    .map(normalizePokemonTcg)
    .filter((item): item is CardCandidate => Boolean(item));
}

async function searchCardCorpse(query: string, setCode?: string, number?: string) {
  if (!process.env.CARD_CORPSE_SEARCH_URL) return [];
  const url = new URL(process.env.CARD_CORPSE_SEARCH_URL);
  if (query) url.searchParams.set("q", query);
  if (setCode) url.searchParams.set("set", setCode);
  if (number) url.searchParams.set("number", number);
  const headers: Record<string, string> = {};
  if (process.env.CARD_CORPSE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.CARD_CORPSE_API_KEY}`;
  }
  const data = await fetchJson(url.toString(), headers);
  const items = Array.isArray(data) ? data : data.results ?? data.data ?? [];
  return (items as UnknownRecord[])
    .map(normalizeCardCorpse)
    .filter((item): item is CardCandidate => Boolean(item));
}

function sameCard(left: CardCandidate, right: CardCandidate) {
  if (left.setCode && right.setCode && left.number && right.number) {
    const sameReleaseIdentity =
      left.setCode.toLowerCase() === right.setCode.toLowerCase() &&
      left.number.toLowerCase() === right.number.toLowerCase();
    if (sameReleaseIdentity) return true;
  }
  return Boolean(
    left.pokedexId &&
    right.pokedexId &&
    left.pokedexId === right.pokedexId &&
    left.hp &&
    right.hp &&
    left.hp === right.hp &&
    left.illustrator &&
    right.illustrator &&
    left.illustrator.toLowerCase() === right.illustrator.toLowerCase()
  );
}

async function tcgdexFallback(card: CardCandidate) {
  if (card.source !== "tcgdex") return null;
  const fallbackLanguage = card.language === "de" ? "en" : "de";
  const externalId = card.id.split(":").slice(2).join(":");
  try {
    const item = (await fetchJson(
      `https://api.tcgdex.net/v2/${fallbackLanguage}/cards/${encodeURIComponent(externalId)}`
    )) as UnknownRecord;
    return normalizeTcgdex(item, fallbackLanguage);
  } catch {
    return null;
  }
}

async function fillMissingImages(cards: CardCandidate[]) {
  const fallbackProviders = cards.filter((card) => card.image);
  await Promise.all(
    cards.map(async (card) => {
      if (card.image) return;
      const configuredSource =
        fallbackProviders.find(
          (candidate) =>
            candidate.source === "cardcorpse" &&
            sameCard(card, candidate)
        ) ??
        fallbackProviders.find(
          (candidate) =>
            candidate.language === "de" &&
            sameCard(card, candidate)
        ) ??
        fallbackProviders.find(
          (candidate) =>
            candidate.language === "en" &&
            sameCard(card, candidate)
        );
      const fallback = configuredSource ?? await tcgdexFallback(card);
      if (fallback?.image) {
        card.image = fallback.image;
        card.imageFallback = true;
        card.imageFallbackLanguage = fallback.language;
      }
    })
  );
  return cards;
}

export async function searchCards(
  query: string,
  languages = ["de", "en", "ja"],
  setCode?: string,
  number?: string,
  hydrate = false
) {
  const directIdentitySearch = Boolean(setCode && number);
  const effectiveQuery = directIdentitySearch ? "" : query;
  const localizations = await localizedCorpusNames(effectiveQuery);
  const cardSuffix = effectiveQuery.match(/\s+(ex|v|max|vstar|gx)$/i)?.[0] ?? "";
  const localizedQueries = languages.map((language) => ({
    language,
    query:
      (localizations[0]?.names[
        language === "zh-cn" ? "zh-Hans" : language === "ja" ? "ja-Hrkt" : language
      ] ?? effectiveQuery.replace(/\s+(ex|v|max|vstar|gx)$/i, "")) + cardSuffix
  }));
  const queryVariants = localizedQueries.map((item) => ({
    ...item,
    values: [...new Set([item.query, effectiveQuery])]
  }));
  const [tcgdex, pokemonTcg, cardCorpus, cardCorpse] = await Promise.allSettled([
    Promise.all(queryVariants.map(({ language, values }) =>
      Promise.all(values.map((value) => searchTcgdex(value, [language], setCode, number, hydrate)))
        .then((batches) => batches.flat())
    )).then((batches) => batches.flat()),
    languages.includes("en") ? searchPokemonTcg(query, setCode, number) : Promise.resolve([]),
    Promise.all(
      queryVariants.map(({ language, values }) =>
        Promise.all(values.map((value) => searchCardCorpus(value, [language], setCode, number)))
          .then((batches) => batches.flat())
      )
    ).then((batches) => batches.flat()),
    searchCardCorpse(query, setCode, number)
  ]);
  const cards = [tcgdex, pokemonTcg, cardCorpus, cardCorpse].flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );
  const deduplicated = new Map<string, CardCandidate>();
  for (const card of cards) {
    const key = [
      card.language,
      normalizedSetCode(card.setCode),
      normalizeCardNumber(card.number),
      normalizedCardIdentity(card)
    ].join("|");
    const existing = deduplicated.get(key);
    if (
      !existing ||
      Boolean(card.image) && !existing.image ||
      card.source === "cardcorpus" && existing.source !== "cardcorpus"
    ) {
      deduplicated.set(key, card);
    }
  }
  const enriched = await fillMissingImages([...deduplicated.values()]);
  return enriched.sort((a, b) => {
    const exactA = normalizedSetCode(a.setCode) === normalizedSetCode(setCode ?? "") ? 1 : 0;
    const exactB = normalizedSetCode(b.setCode) === normalizedSetCode(setCode ?? "") ? 1 : 0;
    if (exactA !== exactB) return exactB - exactA;
    const fallbackA = a.imageFallback ? 1 : 0;
    const fallbackB = b.imageFallback ? 1 : 0;
    if (fallbackA !== fallbackB) return fallbackA - fallbackB;
    const corpusA = a.source === "cardcorpus" ? 1 : 0;
    const corpusB = b.source === "cardcorpus" ? 1 : 0;
    return corpusB - corpusA;
  });
}

function normalizedSetCode(value: string) {
  return value.toLowerCase().replace(/[\s._-]/g, "");
}

function normalizedCardIdentity(card: CardCandidate) {
  return card.pokedexId
    ? String(card.pokedexId)
    : baseCardName(card.baseName ?? card.name).toLowerCase();
}

function words(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]/gi, " ");
}

export function canonicalScore(reference: CardCandidate, candidate: CardCandidate) {
  let score = 0;
  const reasons: string[] = [];
  if (reference.pokedexId && candidate.pokedexId && reference.pokedexId === candidate.pokedexId) {
    score += 0.3;
    reasons.push("Pokédex-ID");
  }
  if (reference.hp && candidate.hp && reference.hp === candidate.hp) {
    score += 0.15;
    reasons.push("KP");
  }
  if (
    reference.illustrator &&
    candidate.illustrator &&
    words(reference.illustrator) === words(candidate.illustrator)
  ) {
    score += 0.2;
    reasons.push("Illustrator");
  }
  if (
    reference.rarity &&
    candidate.rarity &&
    words(reference.rarity) === words(candidate.rarity)
  ) {
    score += 0.1;
    reasons.push("Seltenheit");
  }
  const moveMatches = [...reference.attacks, ...reference.abilities].filter((move) =>
    [...candidate.attacks, ...candidate.abilities].some(
      (other) => words(move) === words(other) && Boolean(words(move).trim())
    )
  );
  if (moveMatches.length) {
    score += Math.min(0.2, moveMatches.length * 0.1);
    reasons.push("Attacken/Fähigkeiten");
  }
  if (reference.releaseDate && candidate.releaseDate) {
    const days = Math.abs(
      new Date(reference.releaseDate).getTime() - new Date(candidate.releaseDate).getTime()
    ) / 86_400_000;
    if (days >= 0 && days <= 130) {
      score += 0.05;
      reasons.push("Release-Fenster");
    }
  }
  return { score: Math.min(1, score), reasons };
}

export async function enrichWithImageHash(
  reference: CardCandidate,
  candidates: CardCandidate[]
) {
  if (!reference.image) return candidates;
  let sourceHash: bigint | undefined;
  try {
    sourceHash = await perceptualHash(reference.image);
  } catch {
    return candidates;
  }
  await Promise.all(
    candidates.map(async (candidate) => {
      if (!candidate.image || candidate.score === undefined) return;
      try {
        const targetHash = await perceptualHash(candidate.image);
        const distance = hammingDistance(sourceHash!, targetHash);
        if (distance <= 10) {
          candidate.score = Math.min(1, candidate.score + 0.25);
          candidate.matchReason = [...(candidate.matchReason ?? []), `Artwork pHash (${distance})`];
        }
      } catch {
        // A failed optional image hash does not invalidate the metadata match.
      }
    })
  );
  return candidates;
}

async function localizedPokemonNames(pokedexId?: number) {
  if (!pokedexId) return new Map<string, string>();
  const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokedexId}`, {
    next: { revalidate: 86400 }
  });
  if (!response.ok) return new Map<string, string>();
  const data = (await response.json()) as {
    names?: Array<{ language: { name: string }; name: string }>;
  };
  const requestedLanguages: Record<string, string> = {
    de: "de",
    en: "en",
    fr: "fr",
    it: "it",
    es: "es",
    pt: "pt-BR",
    nl: "nl",
    pl: "pl",
    ja: "ja-Hrkt",
    ko: "ko",
    "zh-cn": "zh-Hans"
  };
  const names = new Map<string, string>();
  for (const [tcgLanguage, apiLanguage] of Object.entries(requestedLanguages)) {
    const name = data.names?.find((item) => item.language.name === apiLanguage)?.name;
    if (name) names.set(tcgLanguage, name);
  }
  return names;
}

export async function findVariants(reference: CardCandidate) {
  const hydratedReference = await hydrateTcgdexCard(reference);
  const languages = TCGDEX_LANGUAGES.filter(
    (language) => language !== hydratedReference.language
  );
  const [localizedNamesResult, directCorpusResult, corpusSpeciesResult] = await Promise.allSettled([
    localizedPokemonNames(hydratedReference.pokedexId),
    cardCorpusCounterparts(hydratedReference),
    localizedCorpusNames(hydratedReference.baseName ?? hydratedReference.name)
  ]);
  const directCorpusCounterparts =
    directCorpusResult.status === "fulfilled" ? directCorpusResult.value : [];
  const localizedNames =
    localizedNamesResult.status === "fulfilled"
      ? localizedNamesResult.value
      : new Map<string, string>();
  const corpusSpecies =
    corpusSpeciesResult.status === "fulfilled" ? corpusSpeciesResult.value[0] : undefined;
  if (corpusSpecies) {
    const aliases: Record<string, string> = {
      de: "de",
      en: "en",
      fr: "fr",
      it: "it",
      es: "es",
      pt: "pt",
      nl: "nl",
      pl: "pl",
      ja: "ja-Hrkt",
      ko: "ko",
      "zh-cn": "zh-Hans"
    };
    for (const [language, corpusLanguage] of Object.entries(aliases)) {
      if (!localizedNames.has(language) && corpusSpecies.names[corpusLanguage]) {
        localizedNames.set(language, corpusSpecies.names[corpusLanguage]);
      }
    }
  }
  const regionalPrints = await Promise.allSettled(
    [hydratedReference, ...directCorpusCounterparts].flatMap((counterpart) =>
      languages
        .filter((language) => !directCorpusCounterparts.some(
          (candidate) => candidate.language === language
        ))
        .map(async (language) => {
          const localizedName =
            localizedNames.get(language) ??
            counterpart.name;
          const matches = await searchTcgdex(
            localizedName,
            [language],
            undefined,
            normalizeCardNumber(counterpart.number),
            true
          );
          const exactSet = matches.find(
            (card) => card.setCode.toLowerCase() === counterpart.setCode.toLowerCase()
          );
          const metadataMatch = matches.find((card) =>
            counterpart.pokedexId &&
            card.pokedexId === counterpart.pokedexId &&
            counterpart.illustrator &&
            card.illustrator?.toLowerCase() === counterpart.illustrator.toLowerCase()
          );
          const imageMatches = await enrichWithImageHash(counterpart, matches.map((card) => ({
            ...card,
            score: 0,
            matchReason: []
          })));
          const artworkMatch = imageMatches
            .filter((card) => card.score! >= 0.25)
            .sort((left, right) => right.score! - left.score!)[0];
          const onlyCandidate = matches.length === 1 ? matches[0] : undefined;
          const match = exactSet ?? metadataMatch ?? artworkMatch ?? onlyCandidate;
          if (match && !match.image) {
            match.image = counterpart.image;
            match.imageFallback = true;
            match.imageFallbackLanguage = counterpart.language;
          }
          return match
            ? {
                ...match,
                score: 0.95,
                canonicalCardId: match.canonicalCardId ??
                  `cardcorpus-equivalence:${pointerIdentity(hydratedReference)}`,
                corpusSet: directCorpusCounterparts[0]?.corpusSet,
                corpusCard: directCorpusCounterparts[0]?.corpusCard,
                matchReason: exactSet
                  ? ["Gleiches Set und gleiche Kartennummer"]
                  : metadataMatch
                    ? ["Gleiche Pokédex-ID, Nummer und Illustrator"]
                    : artworkMatch
                      ? ["Gleiche Kartennummer und Artwork"]
                      : ["Gleiche Sprachkartennummer"]
              }
            : null;
        })
    )
  ).then((results) =>
    results.flatMap((result) =>
      result.status === "fulfilled" && result.value ? [result.value] : []
    )
  );
  const searches = directCorpusCounterparts.length
    ? []
    : await Promise.allSettled(
        languages.map((language) =>
          searchCards(
            localizedNames.get(language) ?? hydratedReference.baseName ?? baseCardName(hydratedReference.name),
            [language],
            undefined,
            undefined,
            true
          )
        )
      );
  const englishFallback =
    directCorpusCounterparts.length || !languages.includes("en")
      ? []
      : await searchPokemonTcg(hydratedReference.baseName ?? hydratedReference.name).catch(() => []);
  const results = [
    ...directCorpusCounterparts,
    ...regionalPrints,
    ...searches.flatMap((result) => result.status === "fulfilled" ? result.value : []),
    ...englishFallback
  ];
  const uniqueResults = [...new Map(results.map((card) => [card.id, card])).values()];
  const scored = uniqueResults
    .filter((card) => card.id !== hydratedReference.id)
    .filter((card) => card.language !== hydratedReference.language)
    .map((card) => {
      const match = canonicalScore(hydratedReference, card);
      return {
        ...card,
        score: card.score && card.score >= 0.9 ? card.score : match.score,
        matchReason: card.score && card.score >= 0.9
          ? card.matchReason
          : match.reasons
      };
    })
    .filter((card) => card.score! >= 0.25)
    .sort((a, b) => b.score! - a.score!);
  return (await enrichWithImageHash(hydratedReference, scored.slice(0, 18))).filter(
    (card) => card.score! >= 0.3
  );
}

function pointerIdentity(card: CardCandidate) {
  return card.corpusSet && card.corpusCard
    ? `${card.corpusSet}:${card.corpusCard}`
    : `${card.setCode}:${card.number}`;
}
