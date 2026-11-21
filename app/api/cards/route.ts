import { NextRequest, NextResponse } from "next/server";
import { searchCards } from "@/lib/cards";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const setCode = request.nextUrl.searchParams.get("set")?.trim();
  const number = request.nextUrl.searchParams.get("number")?.trim();
  const languages = (request.nextUrl.searchParams.get("languages") ?? "de,en,ja,ko,zh-cn")
    .split(",")
    .map((language) => language.trim().toLowerCase());
  const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  if (!query && !setCode && !number) {
    return NextResponse.json(
      { message: "Name, Set-Code oder Kartennummer ist erforderlich." },
      { status: 400 }
    );
  }
  try {
    const result = await searchCards(
      query,
      languages,
      setCode || undefined,
      number || undefined,
      false,
      { page, pageSize: 20 }
    );
    return NextResponse.json({
      ...result,
      sources: [
        "TCGdex",
        "Pokémon TCG",
        ...(process.env.CARD_CORPSE_SEARCH_URL ? ["CardCorpse"] : [])
      ],
      cardCorpseConfigured: Boolean(process.env.CARD_CORPSE_SEARCH_URL)
    });
  } catch (error) {
    console.error("Kartensuche:", error);
    return NextResponse.json({ message: "Kartendatenquellen sind momentan nicht erreichbar." }, { status: 502 });
  }
}
