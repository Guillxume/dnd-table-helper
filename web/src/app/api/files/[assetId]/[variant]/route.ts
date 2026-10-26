import { NextResponse } from "next/server";
import { z } from "zod";
import { getAssetFileKeys } from "@/server/assets/asset-queries";
import { logError } from "@/server/errors";
import { getUserFromRequest } from "@/server/session";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

const paramsSchema = z.object({
  assetId: z.uuid(),
  variant: z.enum(["thumbnail", "preview", "original"]),
});

function contentDisposition(kind: "inline" | "attachment", filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Sert les fichiers d'une illustration après contrôle de session.
 * Le bucket n'est jamais exposé : c'est l'unique chemin d'accès aux fichiers.
 *
 * Cache : `private, no-cache` + ETag. Le navigateur garde le fichier mais
 * revalide à chaque affichage ; une session expirée reçoit donc 401 au lieu
 * de la copie en cache. Le 304 évite de relire le stockage.
 */
export async function GET(request: Request, context: RouteContext<"/api/files/[assetId]/[variant]">) {
  const user = await getUserFromRequest(request);
  if (!user) return new NextResponse("Authentification requise.", { status: 401 });

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return new NextResponse("Introuvable.", { status: 404 });
  const { assetId, variant } = params.data;

  const asset = await getAssetFileKeys(assetId);
  if (!asset) return new NextResponse("Introuvable.", { status: 404 });

  // Les clés sont propres à chaque illustration et jamais réécrites : l'ETag peut en dériver.
  const etag = `"${assetId}-${variant}"`;
  const baseHeaders = {
    ETag: etag,
    "Cache-Control": "private, no-cache",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: baseHeaders });
  }

  const key =
    variant === "original" ? asset.originalKey : variant === "preview" ? asset.previewKey : asset.thumbnailKey;
  try {
    const object = await getStorage().get(key);
    if (!object) {
      logError("api:files", new Error(`Fichier manquant dans le stockage pour l'illustration ${assetId} (${variant})`));
      return new NextResponse("Fichier indisponible.", { status: 404 });
    }
    const download = new URL(request.url).searchParams.get("download") === "1";
    const headers = new Headers(baseHeaders);
    headers.set("Content-Type", variant === "original" ? asset.mimeType : "image/webp");
    if (object.contentLength !== undefined) headers.set("Content-Length", String(object.contentLength));
    if (variant === "original") {
      headers.set("Content-Disposition", contentDisposition(download ? "attachment" : "inline", asset.originalFilename));
    }
    return new NextResponse(object.body, { status: 200, headers });
  } catch (error) {
    logError("api:files", error);
    return new NextResponse("Stockage indisponible.", { status: 502 });
  }
}
