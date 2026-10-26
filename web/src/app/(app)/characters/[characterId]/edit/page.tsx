import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CharacterForm } from "@/components/characters/character-form";
import { PageHeader } from "@/components/shared/page-header";
import { getCharacter } from "@/server/characters/characters";
import { requireUser } from "@/server/session";
import { updateCharacterAction } from "../../actions";

export const metadata: Metadata = { title: "Modifier la fiche" };

export default async function EditCharacterPage({ params }: PageProps<"/characters/[characterId]/edit">) {
  await requireUser();
  const { characterId } = await params;
  if (!z.uuid().safeParse(characterId).success) notFound();
  const character = await getCharacter(characterId);
  if (!character) notFound();
  return (
    <>
      <PageHeader title={`Modifier ${character.name}`} />
      <CharacterForm
        action={updateCharacterAction.bind(null, character.id)}
        defaults={character}
        cancelHref={`/characters/${character.id}`}
        submitLabel="Enregistrer"
      />
    </>
  );
}
