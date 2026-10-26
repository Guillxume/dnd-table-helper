import { GitBranchPlus, History, PenLine, SquarePen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  DeleteGuideButton,
  EditGuideInfoDialog,
  GuideReferences,
  NewStyleGuideDialog,
} from "@/components/style-guides/style-guide-parts";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { STYLE_ASPECT_LABELS, STYLE_ASPECT_ORDER } from "@/lib/labels";
import { getStyleGuide } from "@/server/style-guides/style-guides";
import { requireUser } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/style-guides/[guideId]">): Promise<Metadata> {
  const { guideId } = await params;
  if (!z.uuid().safeParse(guideId).success) return { title: "Guide" };
  return { title: (await getStyleGuide(guideId))?.name ?? "Guide" };
}

export default async function StyleGuidePage({ params, searchParams }: PageProps<"/style-guides/[guideId]">) {
  await requireUser();
  const { guideId } = await params;
  if (!z.uuid().safeParse(guideId).success) notFound();
  const guide = await getStyleGuide(guideId);
  if (!guide) notFound();
  const { saved } = await searchParams;

  const defined = new Set(guide.effectiveRules.map((rule) => rule.aspect));
  const undefinedAspects = STYLE_ASPECT_ORDER.filter((aspect) => !defined.has(aspect));

  return (
    <>
      <PageHeader
        eyebrow={
          <span>
            <Link href="/style-guides" className="hover:text-foreground hover:underline">
              Direction artistique
            </Link>
            {guide.parent ? (
              <>
                {" › "}
                <Link href={`/style-guides/${guide.parent.id}`} className="hover:text-foreground hover:underline">
                  {guide.parent.name}
                </Link>
              </>
            ) : null}
          </span>
        }
        title={guide.name}
        description={guide.description ?? undefined}
        actions={
          <>
            <Button asChild>
              <Link href={`/style-guides/${guide.id}/edit`}>
                <SquarePen aria-hidden />
                Modifier les règles
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/workshop/new?guide=${guide.id}`}>
                <PenLine aria-hidden />
                Préparer un brief
              </Link>
            </Button>
            <EditGuideInfoDialog id={guide.id} name={guide.name} description={guide.description} />
            {!guide.parentId ? (
              <NewStyleGuideDialog
                parents={[{ id: guide.id, name: guide.name }]}
                defaultParentId={guide.id}
                trigger={
                  <Button variant="outline">
                    <GitBranchPlus aria-hidden />
                    Créer une variante
                  </Button>
                }
              />
            ) : null}
            <DeleteGuideButton id={guide.id} name={guide.name} hasVariants={guide.variants.length > 0} />
          </>
        }
      />

      {saved ? (
        <p role="status" className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm">
          {saved === "unchanged" ? "Aucune règle modifiée : pas de nouvelle version." : `Version ${saved} enregistrée.`}
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          Version {guide.version?.number ?? 1}
          {guide.version ? ` · ${formatDateTime(guide.version.createdAt)}` : ""}
        </span>
        <Link href={`/style-guides/${guide.id}/versions`} className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
          <History className="size-4" aria-hidden />
          Historique ({guide._count.versions})
        </Link>
        {guide.variants.length > 0 ? (
          <span>
            Variantes :{" "}
            {guide.variants.map((variant, index) => (
              <span key={variant.id}>
                {index > 0 ? ", " : ""}
                <Link href={`/style-guides/${variant.id}`} className="text-primary hover:underline">
                  {variant.name}
                </Link>
              </span>
            ))}
          </span>
        ) : null}
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="rules-title">
          <h2 id="rules-title" className="mb-4 font-heading text-xl font-semibold">
            Règles {guide.parent ? "effectives" : ""}
          </h2>
          {guide.effectiveRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune règle définie.{" "}
              <Link href={`/style-guides/${guide.id}/edit`} className="text-primary hover:underline">
                Rédiger les règles
              </Link>
            </p>
          ) : (
            <dl className="space-y-4">
              {guide.effectiveRules.map((rule) => (
                <div key={rule.aspect} className={rule.aspect === "AVOID" ? "rounded-lg border border-destructive/30 p-3" : undefined}>
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{STYLE_ASPECT_LABELS[rule.aspect]}</dt>
                  {rule.common ? (
                    <dd className="mt-1 text-sm whitespace-pre-line">
                      {guide.parent ? <span className="mr-1 text-xs text-muted-foreground">Commun :</span> : null}
                      {rule.common}
                    </dd>
                  ) : null}
                  {rule.specific ? (
                    <dd className="mt-1 border-l-2 border-primary/50 pl-2 text-sm whitespace-pre-line">
                      <span className="mr-1 text-xs text-muted-foreground">Variante :</span>
                      {rule.specific}
                    </dd>
                  ) : null}
                </div>
              ))}
            </dl>
          )}
          {undefinedAspects.length > 0 && guide.effectiveRules.length > 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Non définis : {undefinedAspects.map((aspect) => STYLE_ASPECT_LABELS[aspect].toLowerCase()).join(", ")}.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="guide-refs-title">
          <h2 id="guide-refs-title" className="mb-4 font-heading text-xl font-semibold">
            Références par aspect
          </h2>
          <GuideReferences guideId={guide.id} references={guide.references} />
        </section>
      </div>
    </>
  );
}
