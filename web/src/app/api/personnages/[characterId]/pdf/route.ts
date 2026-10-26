import { NextResponse } from "next/server";
import { DomainError, logError } from "@/server/errors";
import { characterSheetPdf } from "@/server/game/character-creation";
import { getGameActor } from "@/server/game/membership";
import { getMemberFromRequest } from "@/server/session";
import { pdfResponse } from "@/server/game/pdf-response";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/personnages/[characterId]/pdf">) {
  const user = await getMemberFromRequest(request);
  if (!user) return new NextResponse("Authentification requise.", { status: 401 });
  const id = Number((await context.params).characterId);
  if (!Number.isInteger(id) || id <= 0) return new NextResponse("Introuvable.", { status: 404 });
  try {
    const { buffer, name } = await characterSheetPdf(await getGameActor(user), id);
    return pdfResponse(buffer, name);
  } catch (error) {
    if (error instanceof DomainError) return new NextResponse("Introuvable.", { status: 404 });
    logError("api:character-pdf", error);
    return new NextResponse("La génération de la fiche a échoué.", { status: 500 });
  }
}
