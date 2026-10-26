"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { formToObject, idSchema, parseJsonField, refreshAll, runAction } from "@/server/action-utils";
import {
  briefParamsSchema,
  briefTextSchema,
  createBrief,
  deleteBrief,
  updateBriefParams,
  updateBriefText,
} from "@/server/briefs/briefs";

function parseParams(form: FormData) {
  const raw = formToObject(form);
  return briefParamsSchema.parse({ ...raw, references: parseJsonField(raw.references) ?? [] });
}

export async function createBriefAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  let createdId: string | undefined;
  const result = await runAction("briefs:create", async () => {
    createdId = (await createBrief(parseParams(form))).id;
    refreshAll();
  });
  if (createdId) redirect(`/workshop/${createdId}`);
  return result;
}

export async function updateBriefParamsAction(briefId: string, _previous: unknown, form: FormData): Promise<ActionResult> {
  const id = idSchema.parse(briefId);
  const result = await runAction("briefs:update-params", async () => {
    await updateBriefParams(id, parseParams(form));
    refreshAll();
  });
  if (result.ok) redirect(`/workshop/${id}?regenerated=1`);
  return result;
}

export async function updateBriefTextAction(briefId: string, _previous: unknown, form: FormData): Promise<ActionResult> {
  return runAction("briefs:update-text", async () => {
    await updateBriefText(idSchema.parse(briefId), briefTextSchema.parse(formToObject(form)));
    refreshAll();
    return { ok: true, message: "Brief enregistré." };
  });
}

export async function deleteBriefAction(briefId: string): Promise<ActionResult> {
  return runAction("briefs:delete", async () => {
    await deleteBrief(idSchema.parse(briefId));
    refreshAll();
    return { ok: true, message: "Brief supprimé. Les générations archivées conservent leur copie du brief." };
  });
}
