"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { parseLibraryFilters, searchParamsToRecord } from "@/lib/library-filters";
import { pluralize } from "@/lib/text";
import { formToObject, idListSchema, idSchema, refreshAll, runAction } from "@/server/action-utils";
import {
  assetMetadataSchema,
  deleteAssets,
  getAssetUsage,
  setAssetsCategory,
  setAssetsFavorite,
  updateAssetMetadata,
} from "@/server/assets/asset-mutations";
import { type AssetCard, listAssets, searchAssetsForPicker } from "@/server/assets/asset-queries";
import {
  addAssetsToCollection,
  createCollection,
  removeAssetsFromCollection,
  setCollectionCover,
} from "@/server/library/collections";
import { addTagsToAssets, removeTagFromAssets } from "@/server/library/tags";

type Page = { items: AssetCard[]; total: number };

/** Page suivante de la galerie (chargement progressif). */
export async function loadAssetsPageAction(query: string, offset: number): Promise<ActionResult<Page>> {
  return runAction("library:load", async () => {
    const filters = parseLibraryFilters(searchParamsToRecord(new URLSearchParams(query)));
    const data = await listAssets(filters, { offset: z.number().int().min(0).parse(offset) });
    return { ok: true, data };
  });
}

export async function pickerSearchAction(query: string, offset: number): Promise<ActionResult<Page>> {
  return runAction("library:picker", async () => {
    const data = await searchAssetsForPicker(
      z.string().max(200).parse(query),
      z.number().int().min(0).parse(offset),
    );
    return { ok: true, data };
  });
}

export async function setFavoriteAction(assetIds: string[], isFavorite: boolean): Promise<ActionResult> {
  return runAction("library:favorite", async () => {
    const count = await setAssetsFavorite(idListSchema.parse(assetIds), z.boolean().parse(isFavorite));
    refreshAll();
    return {
      ok: true,
      message: isFavorite ? `${pluralize(count, "illustration")} en favori.` : `${pluralize(count, "favori")} retiré${count > 1 ? "s" : ""}.`,
    };
  });
}

export async function addTagsAction(assetIds: string[], tagNames: string[]): Promise<ActionResult> {
  return runAction("library:add-tags", async () => {
    const names = z.array(z.string().max(60)).min(1).max(20).parse(tagNames);
    await addTagsToAssets(idListSchema.parse(assetIds), names);
    refreshAll();
    return { ok: true, message: "Tags ajoutés." };
  });
}

export async function removeTagAction(assetIds: string[], tagId: string): Promise<ActionResult> {
  return runAction("library:remove-tag", async () => {
    await removeTagFromAssets(idListSchema.parse(assetIds), idSchema.parse(tagId));
    refreshAll();
    return { ok: true, message: "Tag retiré." };
  });
}

export async function addToCollectionAction(assetIds: string[], collectionId: string): Promise<ActionResult> {
  return runAction("library:add-collection", async () => {
    const count = await addAssetsToCollection(idSchema.parse(collectionId), idListSchema.parse(assetIds));
    refreshAll();
    return { ok: true, message: count > 0 ? `${pluralize(count, "illustration")} ajoutée${count > 1 ? "s" : ""}.` : "Déjà présentes dans la collection." };
  });
}

export async function removeFromCollectionAction(assetIds: string[], collectionId: string): Promise<ActionResult> {
  return runAction("library:remove-collection", async () => {
    await removeAssetsFromCollection(idSchema.parse(collectionId), idListSchema.parse(assetIds));
    refreshAll();
    return { ok: true, message: "Retiré de la collection." };
  });
}

export async function createCollectionWithAssetsAction(name: string, assetIds: string[]): Promise<ActionResult<{ id: string }>> {
  return runAction("library:create-collection", async () => {
    const collection = await createCollection({ name: z.string().trim().min(1, "Nom obligatoire.").max(120).parse(name) });
    if (assetIds.length > 0) await addAssetsToCollection(collection.id, idListSchema.parse(assetIds));
    refreshAll();
    return { ok: true, message: `Collection « ${collection.name} » créée.`, data: { id: collection.id } };
  });
}

export async function setCategoryAction(assetIds: string[], categoryId: string | null): Promise<ActionResult> {
  return runAction("library:category", async () => {
    await setAssetsCategory(idListSchema.parse(assetIds), categoryId ? idSchema.parse(categoryId) : null);
    refreshAll();
    return { ok: true, message: "Catégorie mise à jour." };
  });
}

export async function setCollectionCoverAction(collectionId: string, assetId: string): Promise<ActionResult> {
  return runAction("library:cover", async () => {
    await setCollectionCover(idSchema.parse(collectionId), idSchema.parse(assetId));
    refreshAll();
    return { ok: true, message: "Couverture de la collection mise à jour." };
  });
}

export async function getDeletionImpactAction(
  assetIds: string[],
): Promise<ActionResult<Awaited<ReturnType<typeof getAssetUsage>>>> {
  return runAction("library:usage", async () => ({ ok: true, data: await getAssetUsage(idListSchema.parse(assetIds)) }));
}

export async function deleteAssetsAction(assetIds: string[]): Promise<ActionResult> {
  return runAction("library:delete", async () => {
    const count = await deleteAssets(idListSchema.parse(assetIds));
    refreshAll();
    return { ok: true, message: `${pluralize(count, "illustration")} supprimée${count > 1 ? "s" : ""}.` };
  });
}

export async function updateAssetMetadataAction(
  assetId: string,
  _previous: unknown,
  form: FormData,
): Promise<ActionResult> {
  return runAction("library:update", async () => {
    const input = assetMetadataSchema.parse(formToObject(form));
    await updateAssetMetadata(idSchema.parse(assetId), input);
    refreshAll();
    return { ok: true, message: "Informations enregistrées." };
  });
}
