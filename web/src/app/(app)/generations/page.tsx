import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { AssetImage } from "@/components/shared/asset-image";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GenerationStatus } from "@/generated/prisma/enums";
import { formatShortDate } from "@/lib/format";
import { GENERATION_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { listCharacterOptions } from "@/server/characters/characters";
import { listGenerations } from "@/server/generations/generations";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Générations" };

function href(params: { status?: string; character?: string }) {
  const search = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const qs = search.toString();
  return qs ? `/generations?${qs}` : "/generations";
}

export default async function GenerationsPage({ searchParams }: PageProps<"/generations">) {
  await requireUser();
  const params = await searchParams;
  const status = z.enum(GenerationStatus).safeParse(params.status).data;
  const characterId = z.uuid().safeParse(params.character).data;
  const [generations, characters] = await Promise.all([listGenerations({ status, characterId }), listCharacterOptions()]);

  return (
    <>
      <PageHeader
        title="Générations"
        description="Images produites avec ChatGPT Images ou un autre outil, archivées avec leur prompt, leur brief, leurs références et leurs versions successives."
        actions={
          <Button asChild>
            <Link href="/generations/new">
              <Sparkles aria-hidden />
              Archiver une génération
            </Link>
          </Button>
        }
      />
      <nav aria-label="Filtrer par statut" className="mb-3 flex flex-wrap gap-1">
        <Button asChild size="sm" variant={status ? "ghost" : "secondary"}>
          <Link href={href({ character: characterId })}>Toutes</Link>
        </Button>
        {Object.values(GenerationStatus).map((value) => (
          <Button key={value} asChild size="sm" variant={status === value ? "secondary" : "ghost"}>
            <Link href={href({ status: value, character: characterId })} aria-current={status === value ? "page" : undefined}>
              {GENERATION_STATUS_LABELS[value]}
            </Link>
          </Button>
        ))}
      </nav>
      {characters.length > 0 ? (
        <nav aria-label="Filtrer par personnage" className="mb-6 flex flex-wrap gap-1">
          <Button asChild size="xs" variant={characterId ? "ghost" : "outline"}>
            <Link href={href({ status })}>Tous les personnages</Link>
          </Button>
          {characters.map((character) => (
            <Button key={character.id} asChild size="xs" variant={characterId === character.id ? "outline" : "ghost"}>
              <Link href={href({ status, character: character.id })}>{character.name}</Link>
            </Button>
          ))}
        </nav>
      ) : null}

      {generations.length === 0 ? (
        <EmptyState icon={Sparkles} title={status || characterId ? "Aucune génération pour ce filtre" : "Aucune génération archivée"}>
          Préparez un brief dans l&apos;atelier, générez l&apos;image dans ChatGPT, puis archivez le résultat ici.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {generations.map((generation) => (
            <li key={generation.id}>
              <Link href={`/generations/${generation.id}`} className="group block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring">
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
                  {generation.asset ? (
                    <AssetImage
                      assetId={generation.asset.id}
                      alt={generation.title}
                      width={generation.asset.width}
                      height={generation.asset.height}
                      dominantColor={generation.asset.dominantColor}
                      className="h-full"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sans image</div>
                  )}
                  <Badge
                    className={cn(
                      "absolute top-2 left-2",
                      generation.status === "VALIDATED" && "bg-success text-background",
                      generation.status === "REJECTED" && "bg-destructive/90 text-white",
                      (generation.status === "DRAFT" || generation.status === "TO_REVIEW") && "bg-black/70 text-white",
                    )}
                  >
                    {GENERATION_STATUS_LABELS[generation.status]}
                  </Badge>
                </div>
                <p className="mt-1.5 truncate text-sm font-medium group-hover:underline">{generation.title}</p>
                <p className="text-xs text-muted-foreground">
                  {generation.character ? `${generation.character.name} · ` : ""}
                  {formatShortDate(generation.createdAt)}
                  {generation.previousId ? " · nouvelle version" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
