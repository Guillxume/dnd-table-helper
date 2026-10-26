import { NextResponse } from "next/server";
import { z } from "zod";
import { AssetOrigin } from "@/generated/prisma/enums";
import { importAsset } from "@/server/assets/import-asset";
import { getUploadMaxBytes } from "@/server/env";
import { logError } from "@/server/errors";
import { getUserFromRequest } from "@/server/session";

// sharp et le SDK S3 nécessitent le runtime Node.js.
export const runtime = "nodejs";

const fieldsSchema = z.object({
  origin: z.enum(AssetOrigin).optional(),
  title: z.string().max(200).optional(),
  categoryId: z.uuid().optional(),
  collectionId: z.uuid().optional(),
  tags: z.string().max(2000).optional(),
});

function optionalField(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * Import d'un fichier par requête. Le client envoie les fichiers un par un
 * (XMLHttpRequest) pour afficher une progression et une erreur par fichier.
 */
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ status: "error", reason: "Authentification requise." }, { status: 401 });

  // Refus précoce avant de lire le corps ; le contrôle exact a lieu après lecture.
  const maxBytes = getUploadMaxBytes();
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes + 1024 * 1024) {
    return NextResponse.json({ status: "rejected", reason: "Fichier trop volumineux." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ status: "error", reason: "Requête multipart invalide." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ status: "error", reason: "Aucun fichier reçu." }, { status: 400 });
  }

  const fields = fieldsSchema.safeParse({
    origin: optionalField(form, "origin"),
    title: optionalField(form, "title"),
    categoryId: optionalField(form, "categoryId"),
    collectionId: optionalField(form, "collectionId"),
    tags: optionalField(form, "tags"),
  });
  if (!fields.success) {
    return NextResponse.json({ status: "error", reason: "Paramètres d'import invalides." }, { status: 400 });
  }

  try {
    const result = await importAsset({
      filename: file.name,
      declaredType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
      origin: fields.data.origin,
      title: fields.data.title,
      categoryId: fields.data.categoryId,
      collectionId: fields.data.collectionId,
      tagNames: fields.data.tags?.split(",") ?? [],
    });
    const status = result.status === "created" ? 201 : result.status === "duplicate" ? 200 : 422;
    return NextResponse.json(result, { status });
  } catch (error) {
    logError("api:assets:upload", error);
    return NextResponse.json(
      { status: "error", reason: "Erreur serveur pendant l'import. Réessayez." },
      { status: 500 },
    );
  }
}
