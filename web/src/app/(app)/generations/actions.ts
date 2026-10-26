"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { GenerationStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { formToObject, idSchema, parseJsonField, refreshAll, runAction } from "@/server/action-utils";
import {
  attachGenerationImage,
  createGeneration,
  deleteGeneration,
  generationInputSchema,
  generationUpdateSchema,
  promoteGenerationToReference,
  setGenerationStatus,
  updateGeneration,
} from "@/server/generations/generations";

export async function createGenerationAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  let createdId: string | undefined;
  const result = await runAction("generations:create", async () => {
    const raw = formToObject(form);
    createdId = (
      await createGeneration(generationInputSchema.parse({ ...raw, references: parseJsonField(raw.references) ?? [] }))
    ).id;
    refreshAll();
  });
  if (createdId) redirect(`/generations/${createdId}`);
  return result;
}

export async function updateGenerationAction(generationId: string, _previous: unknown, form: FormData): Promise<ActionResult> {
  return runAction("generations:update", async () => {
    await updateGeneration(idSchema.parse(generationId), generationUpdateSchema.parse(formToObject(form)));
    refreshAll();
    return { ok: true, message: "Génération mise à jour." };
  });
}

export async function setGenerationStatusAction(generationId: string, status: GenerationStatus): Promise<ActionResult> {
  return runAction("generations:status", async () => {
    await setGenerationStatus(idSchema.parse(generationId), z.enum(GenerationStatus).parse(status));
    refreshAll();
    return { ok: true, message: "Statut mis à jour." };
  });
}

export async function attachGenerationImageAction(generationId: string, assetId: string): Promise<ActionResult> {
  return runAction("generations:attach", async () => {
    await attachGenerationImage(idSchema.parse(generationId), idSchema.parse(assetId));
    refreshAll();
    return { ok: true, message: "Image rattachée." };
  });
}

export async function deleteGenerationAction(generationId: string): Promise<ActionResult> {
  return runAction("generations:delete", async () => {
    await deleteGeneration(idSchema.parse(generationId));
    refreshAll();
    return { ok: true, message: "Archive supprimée. L'image reste dans la bibliothèque." };
  });
}

export async function promoteGenerationAction(generationId: string): Promise<ActionResult> {
  return runAction("generations:promote", async () => {
    await promoteGenerationToReference(idSchema.parse(generationId));
    refreshAll();
    return { ok: true, message: "Image ajoutée aux références validées du personnage." };
  });
}
