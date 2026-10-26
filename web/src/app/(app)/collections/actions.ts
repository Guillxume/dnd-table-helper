"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { formToObject, idListSchema, idSchema, refreshAll, runAction } from "@/server/action-utils";
import {
  addAssetsToCollection,
  collectionInputSchema,
  createCollection,
  deleteCollection,
  markCollectionViewed,
  updateCollection,
} from "@/server/library/collections";
import { requireUser } from "@/server/session";

export async function createCollectionAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  let createdId: string | undefined;
  const result = await runAction("collections:create", async () => {
    const collection = await createCollection(collectionInputSchema.parse(formToObject(form)));
    createdId = collection.id;
    refreshAll();
  });
  if (createdId) redirect(`/collections/${createdId}`);
  return result;
}

export async function updateCollectionAction(collectionId: string, _previous: unknown, form: FormData): Promise<ActionResult> {
  return runAction("collections:update", async () => {
    await updateCollection(idSchema.parse(collectionId), collectionInputSchema.parse(formToObject(form)));
    refreshAll();
    return { ok: true, message: "Collection mise à jour." };
  });
}

export async function deleteCollectionAction(collectionId: string): Promise<ActionResult> {
  return runAction("collections:delete", async () => {
    await deleteCollection(idSchema.parse(collectionId));
    refreshAll();
    return { ok: true, message: "Collection supprimée. Les illustrations sont conservées." };
  });
}

export async function addAssetsToCollectionAction(collectionId: string, assetIds: string[]): Promise<ActionResult> {
  return runAction("collections:add", async () => {
    await addAssetsToCollection(idSchema.parse(collectionId), idListSchema.parse(assetIds));
    refreshAll();
    return { ok: true, message: "Illustrations ajoutées." };
  });
}

/** Mémorise la consultation (tableau de bord : « collections récemment consultées »). */
export async function markCollectionViewedAction(collectionId: string): Promise<void> {
  await requireUser();
  const id = idSchema.safeParse(collectionId);
  if (id.success) await markCollectionViewed(id.data);
}
