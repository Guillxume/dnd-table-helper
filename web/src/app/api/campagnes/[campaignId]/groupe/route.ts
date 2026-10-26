import { NextResponse } from "next/server";
import { DomainError, logError } from "@/server/errors";
import { groupSheetPdf } from "@/server/game/campaigns";
import { getGameActor } from "@/server/game/membership";
import { pdfResponse } from "@/server/game/pdf-response";
import { getMemberFromRequest } from "@/server/session";

export const runtime = "nodejs";

/** Fiche de groupe de la campagne (MJ). */
export async function GET(request: Request, context: RouteContext<"/api/campagnes/[campaignId]/groupe">) {
  const user = await getMemberFromRequest(request);
  if (!user) return new NextResponse("Authentification requise.", { status: 401 });
  try {
    const { campaignId } = await context.params;
    const { buffer, name } = await groupSheetPdf(await getGameActor(user), campaignId);
    return pdfResponse(buffer, name);
  } catch (error) {
    if (error instanceof DomainError) return new NextResponse(error.message, { status: 403 });
    logError("api:group-sheet", error);
    return new NextResponse("La génération du PDF a échoué.", { status: 500 });
  }
}
