import { ArrowLeft, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { characterLabel } from "@bot/character/label";
import { sheetDiscordText, validateDraft } from "@bot/character/validate";
import { classIcon, speciesIcon } from "@/components/icons/icon-names";
import { MaybeIcon } from "@/components/icons/maybe-icon";
import { RpgIcon } from "@/components/icons/rpg-icons";
import { RichText } from "@/components/player/rich-text";
import { Button } from "@/components/ui/button";
import { NotFoundError } from "@/server/errors";
import { getVisibleCharacter, publicationStatus } from "@/server/game/character-creation";
import { PublishButton } from "@/components/player/publish-button";
import { getGameActor } from "@/server/game/membership";
import { gameEnabled } from "@/server/env";
import { requireMember } from "@/server/session";

export const metadata: Metadata = { title: "Fiche de personnage" };

export default async function CharacterSheetPage({ params, searchParams }: PageProps<"/personnages/[characterId]">) {
  const user = await requireMember();
  // Le layout affiche le message de configuration manquante.
  if (!gameEnabled()) return null;
  const { characterId } = await params;
  const { nouveau } = await searchParams;
  const id = Number(characterId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let character;
  const actor = await getGameActor(user);
  try {
    character = getVisibleCharacter(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const validation = validateDraft(character.draft);
  const story = character.draft.story ?? {};
  const storyFields = [
    ["Origine", story.origin],
    ["Apparence", story.appearance],
    ["Personnalité", story.personality],
    ["Histoire", story.backstory],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));

  return (
    <div className="space-y-6">
      <Link href="/personnages" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Mes personnages
      </Link>

      {nouveau ? (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-5">
          <PartyPopper className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-lg font-medium">Ton personnage est enregistré.</p>
            <p className="text-muted-foreground">
              Télécharge ta fiche ci-dessous et imprime-la pour la séance. Tu peux aussi la publier dans le salon des fiches,
              pour que le MJ et le groupe la voient.
            </p>
          </div>
        </div>
      ) : null}

      <header className="space-y-3">
        <div className="flex items-center gap-4">
          <MaybeIcon name={classIcon(character.draft.classId)} className="size-14 text-brass" />
          <div>
            <h1 className="font-heading text-3xl font-semibold">{character.name}</h1>
            <p className="flex items-center gap-2 text-muted-foreground">
              <MaybeIcon name={speciesIcon(character.draft.speciesId)} className="size-5" />
              {characterLabel(character).replace(/^#\d+ /, "")}
            </p>
          </div>
        </div>
        <Button asChild size="lg" className="h-12 px-6 text-base">
          <a href={`/api/personnages/${character.id}/pdf`}>
            <RpgIcon name="nav-pdf-telecharger" className="size-5" />
            Télécharger la fiche (PDF)
          </a>
        </Button>
        <PublishButton characterId={character.id} status={publicationStatus(actor, character.id)} />
      </header>

      <section className="quest-card p-5 pt-8 sm:p-7 sm:pt-9">
        <h2 className="mb-3 font-heading text-2xl font-semibold">La fiche en détail</h2>
        {validation.sheet ? (
          <RichText text={sheetDiscordText(validation.sheet)} className="leading-relaxed" />
        ) : (
          <p>Cette fiche ne peut pas être calculée : {validation.errors.join(" ")}</p>
        )}
      </section>

      {storyFields.length > 0 ? (
        <section className="quest-card space-y-4 p-5 pt-8 sm:p-7 sm:pt-9">
          <h2 className="font-heading text-2xl font-semibold">Son histoire</h2>
          {storyFields.map(([label, text]) => (
            <div key={label}>
              <h3 className="font-medium">{label}</h3>
              <p className="whitespace-pre-line text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
