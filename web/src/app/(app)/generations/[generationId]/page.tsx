import { CopyPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AssetViewer } from "@/components/library/asset-detail-parts";
import {
  AttachImage,
  DeleteGenerationButton,
  GenerationEditForm,
  GenerationLink,
  PromoteToReference,
  StatusSwitcher,
} from "@/components/generations/generation-parts";
import { AssetImage } from "@/components/shared/asset-image";
import { CopyButton } from "@/components/shared/copy-button";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { REFERENCE_ROLE_LABELS, STYLE_ASPECT_LABELS } from "@/lib/labels";
import { getUploadMaxBytes } from "@/server/env";
import { getGeneration, isValidatedReference } from "@/server/generations/generations";
import { requireUser } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/generations/[generationId]">): Promise<Metadata> {
  const { generationId } = await params;
  if (!z.uuid().safeParse(generationId).success) return { title: "Génération" };
  return { title: (await getGeneration(generationId))?.title ?? "Génération" };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 border-t pt-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default async function GenerationPage({ params }: PageProps<"/generations/[generationId]">) {
  await requireUser();
  const { generationId } = await params;
  if (!z.uuid().safeParse(generationId).success) notFound();
  const generation = await getGeneration(generationId);
  if (!generation) notFound();

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/generations" className="hover:text-foreground hover:underline">
            Générations
          </Link>
        }
        title={generation.title}
        actions={
          <>
            <Button asChild>
              <Link href={`/generations/new?from=${generation.id}`}>
                <CopyPlus aria-hidden />
                Nouvelle version
              </Link>
            </Button>
            <DeleteGenerationButton id={generation.id} title={generation.title} />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-4">
          {generation.asset ? (
            <AssetViewer asset={generation.asset} previousHref={null} nextHref={null} position={null} />
          ) : (
            <div className="space-y-3 rounded-xl border border-dashed p-4">
              <p className="text-sm text-muted-foreground">Aucune image rattachée à cette génération.</p>
              <AttachImage id={generation.id} maxBytes={getUploadMaxBytes()} />
            </div>
          )}

          <section className="space-y-2 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-semibold">Prompt utilisé</h2>
              <CopyButton text={generation.prompt} label="Copier" />
            </div>
            <pre className="font-mono text-[0.8rem] leading-relaxed whitespace-pre-wrap">{generation.prompt}</pre>
          </section>

          {generation.briefSnapshot ? (
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer font-heading text-lg font-semibold">Brief archivé</summary>
              <pre className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{generation.briefSnapshot}</pre>
            </details>
          ) : null}
        </div>

        <aside className="space-y-4">
          <StatusSwitcher id={generation.id} status={generation.status} />
          {generation.status === "VALIDATED" && generation.character && generation.asset ? (
            <PromoteToReference id={generation.id} character={generation.character} promoted={await isValidatedReference(generation)} />
          ) : null}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Archivée le</dt>
            <dd>{formatDateTime(generation.createdAt)}</dd>
            {generation.brief ? (
              <>
                <dt className="text-muted-foreground">Brief</dt>
                <dd>
                  <Link href={`/workshop/${generation.brief.id}`} className="text-primary hover:underline">
                    {generation.brief.title}
                  </Link>
                </dd>
              </>
            ) : null}
            {generation.character ? (
              <>
                <dt className="text-muted-foreground">Personnage</dt>
                <dd>
                  <Link href={`/characters/${generation.character.id}`} className="text-primary hover:underline">
                    {generation.character.name}
                  </Link>
                </dd>
              </>
            ) : null}
            {generation.styleGuideVersion ? (
              <>
                <dt className="text-muted-foreground">Guide</dt>
                <dd>
                  <Link href={`/style-guides/${generation.styleGuideVersion.styleGuide.id}/versions`} className="text-primary hover:underline">
                    {generation.styleGuideVersion.styleGuide.name} v{generation.styleGuideVersion.number}
                  </Link>
                </dd>
              </>
            ) : null}
            {generation.tool ? (
              <>
                <dt className="text-muted-foreground">Outil</dt>
                <dd>{generation.tool}</dd>
              </>
            ) : null}
            {generation.sourceUrl ? (
              <>
                <dt className="text-muted-foreground">Origine</dt>
                <dd className="truncate">
                  <a href={generation.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
                    {generation.sourceUrl}
                  </a>
                </dd>
              </>
            ) : null}
          </dl>

          {generation.ancestors.length > 0 || generation.nextVersions.length > 0 ? (
            <Section title="Versions">
              <ol className="space-y-1 text-sm">
                {generation.ancestors.map((ancestor, index) => (
                  <li key={ancestor.id}>
                    v{index + 1} · <GenerationLink {...ancestor} />
                  </li>
                ))}
                <li className="font-medium">
                  v{generation.ancestors.length + 1} · {generation.title} (cette version)
                </li>
                {generation.nextVersions.map((next) => (
                  <li key={next.id}>
                    v{generation.ancestors.length + 2} · <GenerationLink {...next} />
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          <Section title={`Références utilisées (${generation.references.length})`}>
            {generation.references.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune.</p>
            ) : (
              <ol className="space-y-2">
                {generation.references.map((reference, index) => (
                  <li key={reference.assetId} className="flex gap-3">
                    <Link href={`/library/${reference.asset.id}`} className="w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      <AssetImage
                        assetId={reference.asset.id}
                        alt={reference.asset.title}
                        width={reference.asset.width}
                        height={reference.asset.height}
                        dominantColor={reference.asset.dominantColor}
                      />
                    </Link>
                    <div className="min-w-0 text-sm">
                      <p className="truncate">
                        Image {index + 1} · {reference.asset.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {REFERENCE_ROLE_LABELS[reference.role]}
                        {reference.aspects.length > 0
                          ? ` : ${reference.aspects.map((aspect) => STYLE_ASPECT_LABELS[aspect].toLowerCase()).join(", ")}`
                          : ""}
                        {reference.note ? ` (${reference.note})` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Modifier">
            <GenerationEditForm
              key={generation.updatedAt.toISOString()}
              id={generation.id}
              defaults={{
                title: generation.title,
                prompt: generation.prompt,
                tool: generation.tool,
                sourceUrl: generation.sourceUrl,
                revisionNotes: generation.revisionNotes,
              }}
            />
          </Section>
        </aside>
      </div>
    </>
  );
}
