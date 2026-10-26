import { FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NewCollectionDialog } from "@/components/library/collection-forms";
import { AssetImage } from "@/components/shared/asset-image";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { pluralize } from "@/lib/text";
import { listCollections } from "@/server/library/collections";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  await requireUser();
  const collections = await listCollections();
  return (
    <>
      <PageHeader
        title="Collections"
        description="Regroupements de références par objectif artistique, personnage, univers ou projet. Une illustration peut appartenir à plusieurs collections."
        actions={<NewCollectionDialog />}
      />
      {collections.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Aucune collection" action={<NewCollectionDialog />}>
          Par exemple : « Direction artistique principale », « Portraits de référence », « Cartes de donjons ».
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {collections.map((collection) => (
            <li key={collection.id}>
              <Link
                href={`/collections/${collection.id}`}
                className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring"
              >
                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                  {collection.cover ? (
                    <AssetImage
                      assetId={collection.cover.id}
                      alt=""
                      width={640}
                      height={480}
                      dominantColor={collection.cover.dominantColor}
                      className="h-full transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <FolderOpen className="size-8 text-muted-foreground" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <p className="truncate font-medium group-hover:underline">{collection.name}</p>
                  <p className="text-xs text-muted-foreground">{pluralize(collection._count.assets, "illustration")}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
