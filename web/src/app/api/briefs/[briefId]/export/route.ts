import { NextResponse } from "next/server";
import { z } from "zod";
import { briefToExport, getBrief } from "@/server/briefs/briefs";
import { getEnv } from "@/server/env";
import { slugify } from "@/lib/text";
import { getUserFromRequest } from "@/server/session";

export const runtime = "nodejs";

/** Export JSON du brief et de la description de ses références (sans les fichiers). */
export async function GET(request: Request, context: RouteContext<"/api/briefs/[briefId]/export">) {
  const user = await getUserFromRequest(request);
  if (!user) return new NextResponse("Authentification requise.", { status: 401 });
  const { briefId } = await context.params;
  if (!z.uuid().safeParse(briefId).success) return new NextResponse("Introuvable.", { status: 404 });
  const brief = await getBrief(briefId);
  if (!brief) return new NextResponse("Introuvable.", { status: 404 });

  const body = JSON.stringify(briefToExport(brief, getEnv().BETTER_AUTH_URL), null, 2);
  const filename = `brief-${slugify(brief.title) || brief.id}.json`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
