import { NextRequest, NextResponse } from "next/server";
import { cardCorpusSpecies } from "@/lib/cardcorpus";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.toLowerCase().trim() ?? "";
  const generationValue = Number(request.nextUrl.searchParams.get("generation"));
  const generation = Number.isInteger(generationValue) && generationValue >= 1 && generationValue <= 9
    ? generationValue
    : undefined;
  const pageValue = Number(request.nextUrl.searchParams.get("page") ?? 1);
  const page = Math.max(1, Number.isInteger(pageValue) ? pageValue : 1);
  const pageSize = 96;
  let species;
  try {
    species = await cardCorpusSpecies();
  } catch {
    return NextResponse.json({ message: "Sprite-Suche nicht erreichbar." }, { status: 502 });
  }
  const sprites = species
    .map((pokemon) => {
      const names = Object.values(pokemon.names).map((name) => name.toLowerCase());
      return {
        id: pokemon.dex,
        name: pokemon.names.de ?? pokemon.name,
        englishName: pokemon.name,
        generation: pokemon.generation,
        searchableNames: names,
        image: pokemon.pictures?.artwork
          ? `https://img.cardcorpus.com/s1/480/${pokemon.pictures.artwork}.avif`
          : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.dex}.png`
      };
    })
    .filter((pokemon) => pokemon.id >= 1 && pokemon.id <= 1025)
    .filter((pokemon) => !generation || pokemon.generation === generation)
    .filter(
      (pokemon) =>
        !query ||
        pokemon.searchableNames.some((name) => name.includes(query)) ||
        String(pokemon.id).includes(query) ||
        String(pokemon.id).padStart(4, "0").includes(query)
    )
    .map(({ searchableNames: _names, ...pokemon }) => pokemon);
  const total = sprites.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSprites = sprites.slice((safePage - 1) * pageSize, safePage * pageSize);
  return NextResponse.json({
    sprites: pageSprites,
    page: safePage,
    totalPages,
    total,
    pageSize
  });
}
