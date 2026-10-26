import { NextResponse } from "next/server";
import { DomainError, logError } from "@/server/errors";
import { blankSheetPdf } from "@/server/game/character-creation";
import { getGameActor } from "@/server/game/membership";
import { pdfResponse } from "@/server/game/pdf-response";
import { getMemberFromRequest } from "@/server/session";

export const runtime = "nodejs";

/** Fiche à cases vides de la création en cours (dés lancés à la table). */
export async function GET(request: Request) {
  const user = await getMemberFromRequest(request);
  if (!user) return new NextResponse("Authentification requise.", { status: 401 });
  try {
    const { buffer, name } = await blankSheetPdf(await getGameActor(user));
    return pdfResponse(buffer, name);
  } catch (error) {
    if (error instanceof DomainError) return new NextResponse(error.message, { status: 404 });
    logError("api:blank-sheet", error);
    return new NextResponse("La génération de la fiche a échoué.", { status: 500 });
  }
}
