import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { FavoriteToggle } from "@/components/library/asset-detail-parts";
import { AssetImage } from "@/components/shared/asset-image";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { ASSET_ORIGIN_LABELS } from "@/lib/labels";
import { getAssetsForComparison } from "@/server/assets/asset-queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Comparer" };

const MAX_COMPARED = 4;

export default async function ComparePage({ searchParams }: PageProps<"/library/compare">) {
  await requireUser();
  const { ids } = await searchParams;
  const requested = (typeof ids === "string" ? ids.split(",") : [])
    .filter((id) => z.uuid().safeParse(id).success)
    .slice(0, MAX_COMPARED);
  const assets = await getAssetsForComparison(requested);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/library" className="hover:text-foreground hover:underline">
            Bibliothèque
          </Link>
        }
        title="Comparer"
        description="Côte à côte, à la même hauteur : repérez les références qui incarnent le mieux votre direction artistique."
      />
      {assets.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Sélectionnez de 2 à {MAX_COMPARED} illustrations dans la bibliothèque, puis « Comparer ».
        </p>
      ) : (
        <ul className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 16rem), 1fr))` }}>
          {assets.map((asset) => (
            <li key={asset.id} className="flex flex-col gap-2">
              <Link
                href={`/library/${asset.id}`}
                className="flex h-[60vh] items-center justify-center overflow-hidden rounded-xl bg-checker outline-none focus-visible:ring-3 focus-visible:ring-ring"
              >
                <AssetImage
                  assetId={asset.id}
                  alt={asset.title}
                  width={asset.width}
                  height={asset.height}
                  variant="preview"
                  dominantColor={asset.dominantColor}
                  fit="contain"
                  eager
                  className="h-full max-h-[60vh] w-auto"
                />
              </Link>
              <p className="truncate font-medium">{asset.title}</p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="outline">{ASSET_ORIGIN_LABELS[asset.origin]}</Badge>
                {asset.category ? <Badge variant="secondary">{asset.category.name}</Badge> : null}
                <span>
                  {asset.width}×{asset.height}
                </span>
                {asset.artistName ? <span>· {asset.artistName}</span> : null}
              </div>
              {asset.tags.length > 0 ? (
                <p className="text-xs text-muted-foreground">{asset.tags.map((link) => link.tag.name).join(", ")}</p>
              ) : null}
              <div>
                <FavoriteToggle assetId={asset.id} isFavorite={asset.isFavorite} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
