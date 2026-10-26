"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { formToObject, idSchema, refreshAll, runAction } from "@/server/action-utils";
import { battleMapInputSchema, createBattleMap, deleteBattleMap, updateBattleMap } from "@/server/battle-maps/battle-maps";

function parse(form: FormData) {
  const raw = formToObject(form);
  return battleMapInputSchema.parse({ ...raw, showLabels: raw.showLabels === "on" });
}

export async function createBattleMapAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  let createdId: string | undefined;
  const result = await runAction("maps:create", async () => {
    createdId = (await createBattleMap(parse(form))).id;
    refreshAll();
  });
  if (createdId) redirect(`/cartes/${createdId}`);
  return result;
}

export async function updateBattleMapAction(mapId: string, _previous: unknown, form: FormData): Promise<ActionResult> {
  return runAction("maps:update", async () => {
    await updateBattleMap(idSchema.parse(mapId), parse(form));
    refreshAll();
    return { ok: true, message: "Carte enregistrée." };
  });
}

export async function deleteBattleMapAction(mapId: string): Promise<ActionResult> {
  return runAction("maps:delete", async () => {
    await deleteBattleMap(idSchema.parse(mapId));
    refreshAll();
    return { ok: true, message: "Carte supprimée. L'image reste dans la bibliothèque." };
  });
}
