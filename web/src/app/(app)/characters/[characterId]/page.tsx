import { PenLine, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CharacterReferences, DeleteCharacterButton, TraitBoard } from "@/components/characters/character-parts";
import { AssetImage } from "@/components/shared/asset-image";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CANONICAL_FIELD_LABELS, type CanonicalFieldKey } from "@/lib/brief/build-brief";
import { formatShortDate } from "@/lib/format";
import { CHARACTER_KIND_LABELS, GENERATION_STATUS_LABELS } from "@/lib/labels";
import { getCharacter } from "@/server/characters/characters";
import { requireUser } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/characters/[characterId]">): Promise<Metadata> {
  const { characterId } = await params;
  if (!z.uuid().safeParse(characterId).success) return { title: "Personnage" };
  return { title: (await getCharacter(characterId))?.name ?? "Personnage" };
}

export default async function CharacterPage({ params }: PageProps<"/characters/[characterId]">) {
  await requireUser();
  const { characterId } = await params;
  if (!z.uuid().safeParse(characterId).success) notFound();
  const character = await getCharacter(characterId);
  if (!character) notFound();

  const fields = Object.keys(CANONICAL_FIELD_LABELS) as CanonicalFieldKey[];

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/characters" className="hover:text-foreground hover:underline">
            Personnages
          </Link>
        }
        title={character.name}
        description={character.summary ?? undefined}
        actions={
          <>
            <Button asChild>
              <Link href={`/workshop/new?character=${character.id}`}>
                <PenLine aria-hidden />
                Préparer un brief
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/characters/${character.id}/edit`}>
                <Pencil aria-hidden />
                Modifier la fiche
              </Link>
            </Button>
            <DeleteCharacterButton id={character.id} name={character.name} />
          </>
        }
      />
      <div className="mb-6">
        <Badge variant="outline">{CHARACTER_KIND_LABELS[character.kind]}</Badge>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-8">
          <section aria-labelledby="canon-title">
            <h2 id="canon-title" className="mb-1 font-heading text-xl font-semibold">
              Fiche canonique
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">Faits confirmés. Un champ vide est inconnu.</p>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field}>
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{CANONICAL_FIELD_LABELS[field]}</dt>
                  <dd className={character[field] ? "mt-1 text-sm whitespace-pre-line" : "mt-1 text-sm text-muted-foreground italic"}>
                    {character[field] ?? "Inconnu"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="traits-title">
            <h2 id="traits-title" className="mb-1 font-heading text-xl font-semibold">
              Éléments typés
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Distinguer le canon, les préférences, les propositions et les exclusions. Une proposition ne devient canonique que
              par validation explicite.
            </p>
            <TraitBoard characterId={character.id} traits={character.traits} />
          </section>
        </div>

        <aside className="space-y-8">
          <section aria-labelledby="refs-title">
            <h2 id="refs-title" className="mb-3 font-heading text-xl font-semibold">
              Références visuelles
            </h2>
            <CharacterReferences characterId={character.id} references={character.references} />
          </section>

          <section aria-labelledby="gens-title">
            <h2 id="gens-title" className="mb-3 font-heading text-xl font-semibold">
              Générations
            </h2>
            {character.generations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune génération archivée pour ce personnage.</p>
            ) : (
              <ul className="space-y-2">
                {character.generations.map((generation) => (
                  <li key={generation.id}>
                    <Link
                      href={`/generations/${generation.id}`}
                      className="flex items-center gap-3 rounded-lg p-1.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
                    >
                      <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                        {generation.asset ? (
                          <AssetImage
                            assetId={generation.asset.id}
                            alt=""
                            width={48}
                            height={48}
                            dominantColor={generation.asset.dominantColor}
                            className="h-full"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{generation.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {GENERATION_STATUS_LABELS[generation.status]} · {formatShortDate(generation.createdAt)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
