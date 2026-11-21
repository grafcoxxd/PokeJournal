import { NextRequest, NextResponse } from "next/server";
import { findVariants } from "@/lib/cards";
import type { CardCandidate } from "@/lib/types";
import { parseCardReference, ValidationError } from "@/lib/validation";

export async function POST(request: NextRequest) {
  let card: CardCandidate;
  try {
    card = parseCardReference(await request.json()) as unknown as CardCandidate;
  } catch (error) {
    return NextResponse.json(
      { variants: [], message: error instanceof ValidationError ? error.message : "JSON ist ungültig." },
      { status: 400 }
    );
  }
  try {
    const result = await findVariants(card);
    return NextResponse.json({
      reference: result.reference,
      variants: result.variants,
      partial: result.variants.length === 0
    });
  } catch (error) {
    console.error("Sprach-Pendants:", error);
    return NextResponse.json({
      reference: card,
      variants: [],
      partial: true,
      message: "Sichere Sprach-Pendants konnten momentan nicht geladen werden."
    });
  }
}
