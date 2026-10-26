import { Archive, Download, ShieldAlert, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AssetImage, assetFileUrl } from "@/components/shared/asset-image";
import { PageHeader } from "@/components/shared/page-header";
import { BriefTextEditor, DeleteBriefButton } from "@/components/workshop/brief-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/format";
import { GENERATION_STATUS_LABELS, REFERENCE_ROLE_LABELS, STYLE_ASPECT_LABELS, SUBJECT_TYPE_LABELS } from "@/lib/labels";
import { briefSections, getBrief } from "@/server/briefs/briefs";
import { requireUser } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/workshop/[briefId]">): Promise<Metadata> {
  const { briefId } = await params;
  if (!z.uuid().safeParse(briefId).success) return { title: "Brief" };
  return { title: (await getBrief(briefId))?.title ?? "Brief" };
}

export default async function BriefPage({ params, searchParams }: PageProps<"/workshop/[briefId]">) {
  await requireUser();
  const { briefId } = await params;
  if (!z.uuid().safeParse(briefId).success) notFound();
  const brief = await getBrief(briefId);
  if (!brief) notFound();
  const { regenerated } = await searchParams;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/workshop" className="hover:text-foreground hover:underline">
            Atelier de briefs
          </Link>
        }
        title={brief.title}
        actions={
          <>
            <Button asChild>
              <Link href={`/generations/new?brief=${brief.id}`}>
                <Archive aria-hidden />
                Archiver une génération
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/workshop/${brief.id}/edit`}>
                <SlidersHorizontal aria-hidden />
                Paramètres
              </Link>
            </Button>
            <DeleteBriefButton id={brief.id} title={brief.title} />
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">{SUBJECT_TYPE_LABELS[brief.subjectType]}</Badge>
        {brief.character ? (
          <Link href={`/characters/${brief.character.id}`} className="text-primary hover:underline">
            {brief.character.name}
          </Link>
        ) : null}
        {brief.styleGuideVersion ? (
          <span>
            Guide{" "}
            <Link href={`/style-guides/${brief.styleGuideVersion.styleGuide.id}`} className="text-primary hover:underline">
              {brief.styleGuideVersion.styleGuide.name}
            </Link>{" "}
            v{brief.styleGuideVersion.number}
          </span>
        ) : null}
      </div>

      {regenerated ? (
        <p role="status" className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm">
          Brief régénéré à partir des nouveaux paramètres.
        </p>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <BriefTextEditor
          key={brief.updatedAt.toISOString()}
          briefId={brief.id}
          title={brief.title}
          sections={briefSections(brief)}
          prompt={brief.prompt}
        />

        <aside className="space-y-6">
          <section className="space-y-2 rounded-xl border border-destructive/30 p-4 text-sm">
            <h2 className="flex items-center gap-2 font-medium">
              <ShieldAlert className="size-4 text-destructive" aria-hidden />
              Confidentialité
            </h2>
            <p className="text-muted-foreground">
              ChatGPT n&apos;a pas accès à cette bibliothèque. Les images que vous joignez quittent le stockage privé et sont
              traitées par OpenAI selon ses propres conditions.
            </p>
          </section>

          <section aria-labelledby="brief-refs" className="space-y-3">
            <h2 id="brief-refs" className="font-heading text-lg font-semibold">
              Images à joindre
            </h2>
            {brief.references.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune référence.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Téléchargez-les puis joignez-les dans cet ordre.</p>
                <ol className="space-y-3">
                  {brief.references.map((reference, index) => (
                    <li key={reference.assetId} className="flex gap-3">
                      <div className="w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                        <AssetImage
                          assetId={reference.asset.id}
                          alt={reference.asset.title}
                          width={reference.asset.width}
                          height={reference.asset.height}
                          dominantColor={reference.asset.dominantColor}
                        />
                      </div>
                      <div className="min-w-0 space-y-1 text-sm">
                        <p className="font-medium">
                          Image {index + 1} · <span className="font-normal">{reference.asset.title}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {REFERENCE_ROLE_LABELS[reference.role]}
                          {reference.aspects.length > 0
                            ? ` : ${reference.aspects.map((aspect) => STYLE_ASPECT_LABELS[aspect].toLowerCase()).join(", ")}`
                            : ""}
                        </p>
                        <Button asChild variant="outline" size="xs">
                          <a href={`${assetFileUrl(reference.asset.id, "original")}?download=1`}>
                            <Download aria-hidden />
                            Télécharger
                          </a>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>

          <section aria-labelledby="brief-gens" className="space-y-3">
            <h2 id="brief-gens" className="font-heading text-lg font-semibold">
              Générations issues de ce brief
            </h2>
            {brief.generations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Après avoir généré l&apos;image dans ChatGPT, archivez-la avec « Archiver une génération ».
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-2">
                {brief.generations.map((generation) => (
                  <li key={generation.id}>
                    <Link
                      href={`/generations/${generation.id}`}
                      className="block overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring"
                      title={`${generation.title} · ${GENERATION_STATUS_LABELS[generation.status]} · ${formatShortDate(generation.createdAt)}`}
                    >
                      {generation.asset ? (
                        <AssetImage
                          assetId={generation.asset.id}
                          alt={generation.title}
                          width={generation.asset.width}
                          height={generation.asset.height}
                          dominantColor={generation.asset.dominantColor}
                        />
                      ) : (
                        <div className="flex aspect-square items-center justify-center p-1 text-center text-xs text-muted-foreground">
                          {generation.title}
                        </div>
                      )}
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
