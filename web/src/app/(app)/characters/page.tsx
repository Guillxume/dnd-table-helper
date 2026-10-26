import { UserRound, UserRoundPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AssetImage } from "@/components/shared/asset-image";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHARACTER_KIND_LABELS } from "@/lib/labels";
import { pluralize } from "@/lib/text";
import { listCharacters } from "@/server/characters/characters";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Personnages" };

export default async function CharactersPage() {
  await requireUser();
  const characters = await listCharacters();
  const newButton = (
    <Button asChild>
      <Link href="/characters/new">
        <UserRoundPlus aria-hidden />
        Nouvelle fiche
      </Link>
    </Button>
  );
  return (
    <>
      <PageHeader
        title="Personnages"
        description="Fiches canoniques de votre univers : ce qui est établi, ce qui est préféré, ce qui reste à décider et ce qui est exclu."
        actions={newButton}
      />
      {characters.length === 0 ? (
        <EmptyState icon={UserRound} title="Aucune fiche personnage" action={newButton}>
          Une fiche rassemble la description canonique et les références validées d&apos;un personnage, d&apos;un PNJ ou d&apos;une créature.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {characters.map((character) => (
            <li key={character.id}>
              <Link
                href={`/characters/${character.id}`}
                className="group flex gap-4 rounded-xl border bg-card p-3 outline-none transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring"
              >
                <div className="size-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {character.cover ? (
                    <AssetImage
                      assetId={character.cover.id}
                      alt=""
                      width={96}
                      height={96}
                      dominantColor={character.cover.dominantColor}
                      className="h-full"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <UserRound className="size-8 text-muted-foreground" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-heading text-lg font-semibold group-hover:underline">{character.name}</p>
                  <Badge variant="outline">{CHARACTER_KIND_LABELS[character.kind]}</Badge>
                  <p className="truncate text-xs text-muted-foreground">
                    {[character.species, character.characterClass].filter(Boolean).join(" · ") || "Espèce et classe non renseignées"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pluralize(character._count.references, "référence")} · {pluralize(character._count.generations, "génération")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
