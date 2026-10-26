import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  AssetViewer,
  CollectionEditor,
  DeleteAssetButton,
  FavoriteToggle,
  MetadataForm,
  TagEditor,
} from "@/components/library/asset-detail-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ASSET_ORIGIN_LABELS, GENERATION_STATUS_LABELS, STYLE_ASPECT_LABELS } from "@/lib/labels";
import { libraryFiltersToSearchParams, parseLibraryFilters } from "@/lib/library-filters";
import { formatDateTime } from "@/lib/format";
import { formatBytes } from "@/lib/upload-rules";
import { pluralize } from "@/lib/text";
import { getAssetDetail, getAssetNeighbors } from "@/server/assets/asset-queries";
import { getLibraryOptions } from "@/server/library/options";
import { requireUser } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/library/[assetId]">): Promise<Metadata> {
  const { assetId } = await params;
  if (!z.uuid().safeParse(assetId).success) return { title: "Illustration" };
  const asset = await getAssetDetail(assetId);
  return { title: asset?.title ?? "Illustration" };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 border-t pt-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default async function AssetPage({ params, searchParams }: PageProps<"/library/[assetId]">) {
  await requireUser();
  const { assetId } = await params;
  if (!z.uuid().safeParse(assetId).success) notFound();

  const filters = parseLibraryFilters(await searchParams);
  const [asset, neighbors, options] = await Promise.all([
    getAssetDetail(assetId),
    getAssetNeighbors(filters, assetId),
    getLibraryOptions(),
  ]);
  if (!asset) notFound();

  const query = libraryFiltersToSearchParams(filters).toString();
  const suffix = query ? `?${query}` : "";
  const href = (id: string | null) => (id ? `/library/${id}${suffix}` : null);

  const usage = [
    asset.collections.length > 0 && pluralize(asset.collections.length, "collection"),
    asset.characterLinks.length > 0 && pluralize(asset.characterLinks.length, "fiche personnage", "fiches personnages"),
    asset.styleGuideLinks.length > 0 && pluralize(asset.styleGuideLinks.length, "guide artistique", "guides artistiques"),
    asset._count.briefReferences > 0 && pluralize(asset._count.briefReferences, "brief"),
    asset._count.generationReferences > 0 &&
      pluralize(asset._count.generationReferences, "génération archivée (référence)", "générations archivées (référence)"),
    asset.generationResult && "la génération dont elle est le résultat perdra son image",
    asset._count.battleMaps > 0 && pluralize(asset._count.battleMaps, "carte de bataille supprimée", "cartes de bataille supprimées"),
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 space-y-3">
        <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground">
          <Link href={`/library${suffix}`} className="hover:text-foreground hover:underline">
            Bibliothèque
          </Link>
          <span aria-hidden> / </span>
          <span className="text-foreground">{asset.title}</span>
        </nav>
        <AssetViewer
          asset={asset}
          previousHref={href(neighbors.previousId)}
          nextHref={href(neighbors.nextId)}
          position={neighbors.position ? `${neighbors.position} / ${neighbors.total}` : null}
        />
      </div>

      <aside className="space-y-4">
        <div className="space-y-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight break-words">{asset.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{ASSET_ORIGIN_LABELS[asset.origin]}</Badge>
            {asset.category ? (
              <Link href={`/library?category=${asset.category.id}`}>
                <Badge variant="secondary">{asset.category.name}</Badge>
              </Link>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <FavoriteToggle key={`${asset.id}-${asset.isFavorite}`} assetId={asset.id} isFavorite={asset.isFavorite} />
            <Button asChild variant="outline" size="sm">
              <Link href={`/cartes/nouvelle?asset=${asset.id}`}>Créer une carte de bataille</Link>
            </Button>
            <DeleteAssetButton assetId={asset.id} title={asset.title} usageSummary={usage} />
          </div>
        </div>

        <Section title="Tags">
          <TagEditor
            assetId={asset.id}
            tags={asset.tags.map((link) => link.tag)}
            suggestions={options.tags}
          />
        </Section>

        <Section title="Collections">
          <CollectionEditor
            assetId={asset.id}
            collections={asset.collections.map((link) => link.collection)}
            allCollections={options.collections}
          />
        </Section>

        {asset.characterLinks.length > 0 || asset.styleGuideLinks.length > 0 || asset.generationResult ? (
          <Section title="Utilisations">
            <ul className="space-y-1 text-sm">
              {asset.characterLinks.map((link) => (
                <li key={link.character.id}>
                  Référence {link.validated ? "validée " : ""}de{" "}
                  <Link href={`/characters/${link.character.id}`} className="text-primary hover:underline">
                    {link.character.name}
                  </Link>
                </li>
              ))}
              {asset.styleGuideLinks.map((link) => (
                <li key={link.styleGuide.id}>
                  Guide{" "}
                  <Link href={`/style-guides/${link.styleGuide.id}`} className="text-primary hover:underline">
                    {link.styleGuide.name}
                  </Link>
                  {link.aspects.length > 0
                    ? ` : ${link.aspects.map((aspect) => STYLE_ASPECT_LABELS[aspect].toLowerCase()).join(", ")}`
                    : ""}
                </li>
              ))}
              {asset.generationResult ? (
                <li>
                  Résultat de la génération{" "}
                  <Link href={`/generations/${asset.generationResult.id}`} className="text-primary hover:underline">
                    {asset.generationResult.title}
                  </Link>{" "}
                  ({GENERATION_STATUS_LABELS[asset.generationResult.status].toLowerCase()})
                </li>
              ) : null}
            </ul>
          </Section>
        ) : null}

        <Section title="Informations">
          <MetadataForm
            key={asset.updatedAt.toISOString()}
            assetId={asset.id}
            categories={options.categories}
            defaults={{
              title: asset.title,
              description: asset.description,
              notes: asset.notes,
              artistName: asset.artistName,
              sourceUrl: asset.sourceUrl,
              origin: asset.origin,
              categoryId: asset.category?.id ?? null,
              creationDate: asset.creationDate ? asset.creationDate.toISOString().slice(0, 10) : null,
            }}
          />
        </Section>

        <Section title="Fichier">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Nom d&apos;origine</dt>
            <dd className="break-all">{asset.originalFilename}</dd>
            <dt className="text-muted-foreground">Dimensions</dt>
            <dd>
              {asset.width} × {asset.height} px
            </dd>
            <dt className="text-muted-foreground">Format</dt>
            <dd>
              {asset.mimeType.replace("image/", "").toUpperCase()} · {formatBytes(asset.byteSize)}
            </dd>
            <dt className="text-muted-foreground">Importée le</dt>
            <dd>{formatDateTime(asset.createdAt)}</dd>
            {asset.sourceUrl ? (
              <>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="truncate">
                  <a href={asset.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
                    {asset.sourceUrl}
                  </a>
                </dd>
              </>
            ) : null}
          </dl>
        </Section>
      </aside>
    </div>
  );
}
