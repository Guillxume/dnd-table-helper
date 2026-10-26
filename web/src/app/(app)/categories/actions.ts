"use server";

import type { ActionResult } from "@/lib/action-result";
import { formToObject, idSchema, refreshAll, runAction } from "@/server/action-utils";
import { categoryInputSchema, createCategory, deleteCategory, updateCategory } from "@/server/library/categories";

export async function createCategoryAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  return runAction("categories:create", async () => {
    await createCategory(categoryInputSchema.parse(formToObject(form)));
    refreshAll();
    return { ok: true, message: "Catégorie créée." };
  });
}

export async function updateCategoryAction(categoryId: string, _previous: unknown, form: FormData): Promise<ActionResult> {
  return runAction("categories:update", async () => {
    await updateCategory(idSchema.parse(categoryId), categoryInputSchema.parse(formToObject(form)));
    refreshAll();
    return { ok: true, message: "Catégorie mise à jour." };
  });
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  return runAction("categories:delete", async () => {
    await deleteCategory(idSchema.parse(categoryId));
    refreshAll();
    return { ok: true, message: "Catégorie supprimée." };
  });
}
