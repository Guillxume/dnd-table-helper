"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { formToObject, runMemberAction } from "@/server/action-utils";
import {
  cancelSession,
  discardRecapDraft,
  draftRecap,
  prepare,
  publishRecap,
  removeCarnetEntry,
  savePlayerNote,
  scheduleSession,
  setCreationDeadline,
  updateCreationRules,
  updateStyle,
} from "@/server/game/campaigns";
import { getGameActor } from "@/server/game/membership";

const campaignId = z.string().min(1).max(40);

/** Champ <input type="date"> (AAAA-MM-JJ) vers la saisie du bot (JJ/MM/AAAA). */
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choisis une date.")
  .transform((value) => value.split("-").reverse().join("/"));
const timeField = z.string().regex(/^\d{2}:\d{2}$/, "Choisis une heure.");

function refresh(id: string): void {
  revalidatePath(`/campagnes/${id}`);
  revalidatePath("/campagnes");
}

export async function scheduleSessionAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  return runMemberAction("campaigns:schedule", async (user) => {
    const input = z
      .object({ campaignId, date: dateField, time: timeField, note: z.string().max(500).default(""), announce: z.string().optional() })
      .parse(formToObject(form));
    const label = scheduleSession(await getGameActor(user), input.campaignId, { ...input, announce: input.announce === "on" });
    refresh(input.campaignId);
    return {
      ok: true,
      message: `Séance fixée au ${label}.${input.announce === "on" ? " L'annonce part sur Discord dans moins d'une minute." : ""} Le rappel partira 24 h avant.`,
    };
  });
}

export async function cancelSessionAction(id: string): Promise<ActionResult> {
  return runMemberAction("campaigns:cancel", async (user) => {
    cancelSession(await getGameActor(user), campaignId.parse(id));
    refresh(id);
    return { ok: true, message: "Séance annulée : aucun rappel ne partira." };
  });
}

export async function updateRulesAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  return runMemberAction("campaigns:rules", async (user) => {
    const input = z
      .object({ campaignId, methods: z.array(z.string().max(20)).max(10), content: z.enum(["manuel", "srd"]) })
      .parse(formToObject(form, ["methods"]));
    updateCreationRules(await getGameActor(user), input.campaignId, input);
    refresh(input.campaignId);
    return { ok: true, message: "Règles de création enregistrées. Elles s'appliquent aux nouvelles créations." };
  });
}

export async function deadlineAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  return runMemberAction("campaigns:deadline", async (user) => {
    const input = z.object({ campaignId, date: dateField, time: timeField.or(z.literal("")).default("") }).parse(formToObject(form));
    const label = setCreationDeadline(await getGameActor(user), input.campaignId, input);
    refresh(input.campaignId);
    return { ok: true, message: `Échéance fixée au ${label}. Le bot relancera les retardataires à J-3 et J-1.` };
  });
}

export async function clearDeadlineAction(id: string): Promise<ActionResult> {
  return runMemberAction("campaigns:deadline-clear", async (user) => {
    setCreationDeadline(await getGameActor(user), campaignId.parse(id), null);
    refresh(id);
    return { ok: true, message: "Échéance retirée." };
  });
}

export async function updateStyleAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  return runMemberAction("campaigns:style", async (user) => {
    const text = z.string().max(600, "600 caractères au plus par rubrique.").default("");
    const input = z
      .object({ campaignId, tone: text, vocabulary: text, names: text, avoid: text, example: text })
      .parse(formToObject(form));
    const { campaignId: id, ...style } = input;
    updateStyle(await getGameActor(user), id, style);
    refresh(id);
    return { ok: true, message: "Guide de style enregistré : l'assistant le suivra pour les rappels et les préparations." };
  });
}

export async function playerNoteAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  return runMemberAction("campaigns:player-note", async (user) => {
    const input = z.object({ campaignId, text: z.string().max(1500, "1 500 caractères au plus.") }).parse(formToObject(form));
    savePlayerNote(await getGameActor(user), input.campaignId, input.text);
    refresh(input.campaignId);
    return { ok: true, message: "Merci ! Ta note servira au prochain rappel de séance." };
  });
}

export async function draftRecapAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  const result = await runMemberAction<{ id: string; draftId: string }>("campaigns:recap-draft", async (user) => {
    const input = z.object({ campaignId, notes: z.string().max(8000) }).parse(formToObject(form));
    const draftId = await draftRecap(await getGameActor(user), input.campaignId, input.notes);
    return { ok: true, data: { id: input.campaignId, draftId } };
  });
  if (result.ok && result.data) redirect(`/campagnes/${result.data.id}?onglet=seances&brouillon=${result.data.draftId}`);
  return result.ok ? { ok: true } : result;
}

export async function publishRecapAction(_previous: unknown, form: FormData): Promise<ActionResult> {
  const result = await runMemberAction<{ id: string; message: string }>("campaigns:recap-publish", async (user) => {
    const input = z.object({ campaignId, draftId: z.uuid(), recap: z.string().max(6000) }).parse(formToObject(form));
    const published = await publishRecap(await getGameActor(user), input.campaignId, input.draftId, input.recap);
    refresh(input.campaignId);
    return {
      ok: true,
      data: {
        id: input.campaignId,
        message: `Rappel de la séance ${published.number} publié : il part sur Discord dans moins d'une minute. ${
          published.carnet ? `Carnet mis à jour : ${published.carnet}.` : "Le carnet n'a pas pu être mis à jour cette fois."
        }`,
      },
    };
  });
  if (result.ok && result.data) redirect(`/campagnes/${result.data.id}?onglet=seances&publie=${encodeURIComponent(result.data.message)}`);
  return result.ok ? { ok: true } : result;
}

export async function discardRecapAction(id: string, draftId: string): Promise<ActionResult> {
  return runMemberAction("campaigns:recap-discard", async (user) => {
    discardRecapDraft(await getGameActor(user), campaignId.parse(id), z.uuid().parse(draftId));
    refresh(id);
    return { ok: true, message: "Brouillon supprimé." };
  });
}

export async function prepareAction(id: string, type: string, values: Record<string, string>): Promise<ActionResult<{ text: string }>> {
  return runMemberAction("campaigns:prepare", async (user) => {
    const clean = z.record(z.string().max(30), z.string().max(1500)).parse(values);
    const text = await prepare(await getGameActor(user), campaignId.parse(id), z.string().max(20).parse(type), clean);
    return { ok: true, data: { text } };
  });
}

export async function removeCarnetAction(id: string, kind: string, name: string): Promise<ActionResult> {
  return runMemberAction("campaigns:carnet-remove", async (user) => {
    removeCarnetEntry(await getGameActor(user), campaignId.parse(id), z.enum(["pnj", "lieu", "objet", "fil"]).parse(kind), z.string().max(200).parse(name));
    refresh(id);
    return { ok: true, message: `« ${name} » retiré du carnet.` };
  });
}
