"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { StyleAspect } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { formToObject, idListSchema, idSchema, refreshAll, runAction } from "@/server/action-utils";
import {
  addStyleGuideReferences,
  createStyleGuide,
  deleteStyleGuide,
  removeStyleGuideReference,
  ruleMapSchema,
  saveStyleGuideRules,
  styleGuideInputSchema,
  updateStyleGuideInfo,
  updateStyleGuideReference,
} from "@/server/style-guides/style-guides";

const aspectsSchema = z.array(z.enum(StyleAspect)).max(20);

export async function createStyleGuideAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  let createdId: string | undefined;
  const result = await runAction("guides:create", async () => {
    createdId = (await createStyleGuide(styleGuideInputSchema.parse(formToObject(form)))).id;
    refreshAll();
  });
  if (createdId) redirect(`/style-guides/${createdId}`);
  return result;
}

export async function updateStyleGuideInfoAction(guideId: string, _previous: unknown, form: FormData): Promise<ActionResult> {
  return runAction("guides:update-info", async () => {
    await updateStyleGuideInfo(idSchema.parse(guideId), styleGuideInputSchema.omit({ parentId: true }).parse(formToObject(form)));
    refreshAll();
    return { ok: true, message: "Guide mis à jour." };
  });
}

export async function saveStyleGuideRulesAction(guideId: string, _previous: unknown, form: FormData): Promise<ActionResult> {
  const id = idSchema.parse(guideId);
  let saved: { created: boolean; number: number } | undefined;
  const result = await runAction("guides:save-rules", async () => {
    const raw = formToObject(form);
    const rules = ruleMapSchema.parse(
      Object.fromEntries(Object.values(StyleAspect).map((aspect) => [aspect, String(raw[`rule_${aspect}`] ?? "")])),
    );
    saved = await saveStyleGuideRules(id, rules, z.string().max(500).optional().parse(raw.changeNote));
    refreshAll();
  });
  if (saved) redirect(`/style-guides/${id}?saved=${saved.created ? saved.number : "unchanged"}`);
  return result;
}

export async function deleteStyleGuideAction(guideId: string): Promise<ActionResult> {
  return runAction("guides:delete", async () => {
    await deleteStyleGuide(idSchema.parse(guideId));
    refreshAll();
    return { ok: true, message: "Guide supprimé." };
  });
}

export async function addStyleGuideReferencesAction(guideId: string, assetIds: string[], aspects: string[]): Promise<ActionResult> {
  return runAction("guides:add-refs", async () => {
    await addStyleGuideReferences(idSchema.parse(guideId), idListSchema.parse(assetIds), aspectsSchema.parse(aspects));
    refreshAll();
    return { ok: true, message: "Références ajoutées au guide." };
  });
}

export async function updateStyleGuideReferenceAction(
  guideId: string,
  assetId: string,
  aspects: string[],
  note: string,
): Promise<ActionResult> {
  return runAction("guides:update-ref", async () => {
    await updateStyleGuideReference(idSchema.parse(guideId), idSchema.parse(assetId), {
      aspects: aspectsSchema.parse(aspects),
      note: z.string().max(1000).parse(note),
    });
    refreshAll();
    return { ok: true, message: "Référence mise à jour." };
  });
}

export async function removeStyleGuideReferenceAction(guideId: string, assetId: string): Promise<ActionResult> {
  return runAction("guides:remove-ref", async () => {
    await removeStyleGuideReference(idSchema.parse(guideId), idSchema.parse(assetId));
    refreshAll();
    return { ok: true, message: "Référence retirée du guide." };
  });
}
