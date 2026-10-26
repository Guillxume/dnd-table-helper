import type { Metadata } from "next";
import { CharacterForm } from "@/components/characters/character-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/server/session";
import { createCharacterAction } from "../actions";

export const metadata: Metadata = { title: "Nouvelle fiche personnage" };

export default async function NewCharacterPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Nouvelle fiche personnage" />
      <CharacterForm action={createCharacterAction} cancelHref="/characters" submitLabel="Créer la fiche" />
    </>
  );
}
