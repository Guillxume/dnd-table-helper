"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { formToObject, runMemberAction } from "@/server/action-utils";
import {
  abandonCreation,
  applyWizardAction,
  beginCreation,
  finishCreation,
  requestPublication,
  type WizardAction,
} from "@/server/game/character-creation";
import { askAssistant } from "@/server/game/assistant";
import { getGameActor, refreshDiscordMember } from "@/server/game/membership";

const storyText = z.string().max(1500).optional();

const wizardActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("answer"), stepId: z.string().min(1).max(100), values: z.array(z.string().max(200)).max(60) }),
  z.object({ type: z.literal("back") }),
  z.object({ type: z.literal("roll") }),
  z.object({ type: z.literal("edit"), index: z.number().int().min(0).max(500) }),
  z.object({ type: z.literal("cancelEdit") }),
  z.object({
    type: z.literal("story"),
    story: z.object({ origin: storyText, appearance: storyText, personality: storyText, backstory: storyText }),
  }),
]) satisfies z.ZodType<WizardAction>;

function refresh(): void {
  revalidatePath("/personnages", "layout");
}

export async function startCreationAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  const result = await runMemberAction("players:start", async (user) => {
    const input = z
      .object({ campaignId: z.string().min(1, "Choisis une campagne."), name: z.string().trim().min(2, "Le nom doit faire au moins 2 caractères.").max(40) })
      .parse(formToObject(form));
    beginCreation(await getGameActor(user), input.campaignId, input.name);
    refresh();
  });
  if (result.ok) redirect("/personnages/creation");
  return result;
}

export async function wizardAction(action: WizardAction): Promise<ActionResult> {
  return runMemberAction("players:wizard", async (user) => {
    applyWizardAction(await getGameActor(user), wizardActionSchema.parse(action));
    refresh();
  });
}

export async function abandonCreationAction(): Promise<ActionResult> {
  return runMemberAction("players:abandon", async (user) => {
    abandonCreation(await getGameActor(user));
    refresh();
    return { ok: true, message: "Création abandonnée." };
  });
}

export async function finishCreationAction(): Promise<ActionResult<{ id: number }>> {
  return runMemberAction("players:finish", async (user) => {
    const saved = finishCreation(await getGameActor(user));
    refresh();
    return { ok: true, data: { id: saved.id } };
  });
}

/** Relit les rôles Discord (après un ajout à une campagne par le MJ). */
export async function refreshAccessAction(): Promise<ActionResult> {
  return runMemberAction("players:refresh", async (user) => {
    await refreshDiscordMember(user.id);
    refresh();
    return { ok: true, message: "Accès mis à jour." };
  });
}

export async function requestPublicationAction(characterId: number): Promise<ActionResult> {
  return runMemberAction("players:publish", async (user) => {
    requestPublication(await getGameActor(user), z.number().int().positive().parse(characterId));
    refresh();
    return { ok: true, message: "C'est demandé : la fiche apparaîtra sur Discord dans moins d'une minute." };
  });
}

/** Idées d'histoire ou conseil de sorts pour l'étape en cours (suggestions, rien n'est enregistré). */
export async function assistantAction(kind: "ideas" | "spells"): Promise<ActionResult<{ text: string }>> {
  return runMemberAction("players:assistant", async (user) => {
    const text = await askAssistant(await getGameActor(user), z.enum(["ideas", "spells"]).parse(kind));
    return { ok: true, data: { text } };
  });
}
