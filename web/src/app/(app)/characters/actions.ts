"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { TraitStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { formToObject, idListSchema, idSchema, refreshAll, runAction } from "@/server/action-utils";
import {
  addCharacterReferences,
  addTrait,
  changeTraitStatus,
  characterInputSchema,
  createCharacter,
  deleteCharacter,
  deleteTrait,
  removeCharacterReference,
  setCharacterReferenceValidated,
  traitInputSchema,
  updateCharacter,
  updateTrait,
} from "@/server/characters/characters";

export async function createCharacterAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  let createdId: string | undefined;
  const result = await runAction("characters:create", async () => {
    createdId = (await createCharacter(characterInputSchema.parse(formToObject(form)))).id;
    refreshAll();
  });
  if (createdId) redirect(`/characters/${createdId}`);
  return result;
}

export async function updateCharacterAction(characterId: string, _previous: unknown, form: FormData): Promise<ActionResult> {
  const id = idSchema.parse(characterId);
  const result = await runAction("characters:update", async () => {
    await updateCharacter(id, characterInputSchema.parse(formToObject(form)));
    refreshAll();
  });
  if (result.ok) redirect(`/characters/${id}`);
  return result;
}

export async function deleteCharacterAction(characterId: string): Promise<ActionResult> {
  return runAction("characters:delete", async () => {
    await deleteCharacter(idSchema.parse(characterId));
    refreshAll();
    return { ok: true, message: "Fiche supprimée. Les illustrations et générations sont conservées." };
  });
}

export async function addTraitAction(characterId: string, _previous: unknown, form: FormData): Promise<ActionResult> {
  return runAction("characters:add-trait", async () => {
    const raw = formToObject(form);
    await addTrait(idSchema.parse(characterId), traitInputSchema.parse({ ...raw, locked: raw.locked === "on" }));
    refreshAll();
    return { ok: true, message: "Élément ajouté." };
  });
}

export async function updateTraitAction(traitId: string, content: string, locked: boolean): Promise<ActionResult> {
  return runAction("characters:update-trait", async () => {
    await updateTrait(idSchema.parse(traitId), {
      content: z.string().trim().min(1, "Le contenu est obligatoire.").max(4000).parse(content),
      locked: z.boolean().parse(locked),
    });
    refreshAll();
    return { ok: true, message: "Élément mis à jour." };
  });
}

export async function changeTraitStatusAction(traitId: string, status: TraitStatus): Promise<ActionResult> {
  return runAction("characters:trait-status", async () => {
    await changeTraitStatus(idSchema.parse(traitId), z.enum(TraitStatus).parse(status));
    refreshAll();
    return { ok: true, message: status === "CANON" ? "Validé comme fait canonique." : "Statut modifié." };
  });
}

export async function deleteTraitAction(traitId: string): Promise<ActionResult> {
  return runAction("characters:delete-trait", async () => {
    await deleteTrait(idSchema.parse(traitId));
    refreshAll();
    return { ok: true, message: "Élément supprimé." };
  });
}

export async function addCharacterReferencesAction(characterId: string, assetIds: string[]): Promise<ActionResult> {
  return runAction("characters:add-refs", async () => {
    await addCharacterReferences(idSchema.parse(characterId), idListSchema.parse(assetIds));
    refreshAll();
    return { ok: true, message: "Références ajoutées." };
  });
}

export async function setReferenceValidatedAction(characterId: string, assetId: string, validated: boolean): Promise<ActionResult> {
  return runAction("characters:validate-ref", async () => {
    await setCharacterReferenceValidated(idSchema.parse(characterId), idSchema.parse(assetId), z.boolean().parse(validated));
    refreshAll();
    return { ok: true, message: validated ? "Référence validée." : "Validation retirée." };
  });
}

export async function removeCharacterReferenceAction(characterId: string, assetId: string): Promise<ActionResult> {
  return runAction("characters:remove-ref", async () => {
    await removeCharacterReference(idSchema.parse(characterId), idSchema.parse(assetId));
    refreshAll();
    return { ok: true, message: "Référence retirée de la fiche." };
  });
}
