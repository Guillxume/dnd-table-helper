import { NextResponse } from "next/server";
import { z } from "zod";
import { renderBattleMapPdf } from "@/server/battle-maps/battle-maps";
import { DomainError, logError } from "@/server/errors";
import { pdfResponse } from "@/server/game/pdf-response";
import { getUserFromRequest } from "@/server/session";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/battle-maps/[mapId]/pdf">) {
  const user = await getUserFromRequest(request);
  if (!user) return new NextResponse("Authentification requise.", { status: 401 });
  const { mapId } = await context.params;
  if (!z.uuid().safeParse(mapId).success) return new NextResponse("Introuvable.", { status: 404 });
  try {
    const { buffer, title } = await renderBattleMapPdf(mapId);
    return pdfResponse(buffer, `carte ${title}`);
  } catch (error) {
    if (error instanceof DomainError) return new NextResponse(error.message, { status: 404 });
    logError("api:battle-map-pdf", error);
    return new NextResponse("La génération du PDF a échoué.", { status: 500 });
  }
}
