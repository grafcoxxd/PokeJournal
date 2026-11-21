export type Tab = "albums" | "search" | "settings";

export interface Card {
  id: string;
  source: "tcgdex" | "pokemontcg" | "cardcorpus" | "cardcorpse";
  name: string;
  setCode: string;
  setName: string;
  number: string;
  language: string;
  image: string;
  imageFallback?: boolean;
  imageFallbackLanguage?: string;
  notes?: string;
  hp?: number;
  pokedexId?: number;
  illustrator?: string;
  rarity?: string;
  attacks: string[];
  abilities: string[];
  releaseDate?: string;
  baseName?: string;
  wishValue: number;
  canonicalCardId?: string;
  corpusSet?: string;
  corpusCard?: string;
}

export interface AlbumPage {
  id: string;
  slots: Array<Card | null>;
}

export interface Album {
  id: string;
  title: string;
  coverColor: string;
  innerColor: string;
  spriteId: number | null;
  pages: AlbumPage[];
  createdAt: string;
}

export interface JournalData {
  version: 1;
  albums: Album[];
}

export interface CardCandidate extends Omit<Card, "wishValue"> {
  score?: number;
  matchReason?: string[];
}

export interface ConnectionState {
  connected: boolean;
  message: string;
  storage: "neon" | "unavailable";
  updatedAt?: string;
}

export const COLORS = [
  "#b9d9ff",
  "#bce8c4",
  "#f4baca",
  "#f5dca2",
  "#cfc1f2",
  "#f4c3a7",
  "#bce7e5"
];

export function createPage(): AlbumPage {
  return { id: crypto.randomUUID(), slots: Array.from({ length: 9 }, () => null) };
}

export function createAlbum(title = "Neues Album"): Album {
  return {
    id: crypto.randomUUID(),
    title,
    coverColor: COLORS[0],
    innerColor: "#f5f0e8",
    spriteId: null,
    pages: [createPage()],
    createdAt: new Date().toISOString()
  };
}

export const EMPTY_JOURNAL: JournalData = { version: 1, albums: [] };
