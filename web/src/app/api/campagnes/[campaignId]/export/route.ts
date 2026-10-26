import { NextResponse } from "next/server";
import { DomainError, logError } from "@/server/errors";
import { campaignExportPdf } from "@/server/game/campaigns";
import { getGameActor } from "@/server/game/membership";
import { pdfResponse } from "@/server/game/pdf-response";
import { getMemberFromRequest } from "@/server/session";

export const runtime = "nodejs";

/** Chronique de la campagne : rappels et, sauf ?fiches=0, fiches des personnages (MJ). */
export async function GET(request: Request, context: RouteContext<"/api/campagnes/[campaignId]/export">) {
  const user = await getMemberFromRequest(request);
  if (!user) return new NextResponse("Authentification requise.", { status: 401 });
  try {
    const { campaignId } = await context.params;
    const sheets = new URL(request.url).searchParams.get("fiches") !== "0";
    const { buffer, name } = await campaignExportPdf(await getGameActor(user), campaignId, sheets);
    return pdfResponse(buffer, name);
  } catch (error) {
    if (error instanceof DomainError) return new NextResponse(error.message, { status: 403 });
    logError("api:campaign-export", error);
    return new NextResponse("La génération du PDF a échoué.", { status: 500 });
  }
}
