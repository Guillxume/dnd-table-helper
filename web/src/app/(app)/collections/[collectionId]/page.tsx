import { ImageOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  AddToCollectionPicker,
  DeleteCollectionButton,
  EditCollectionDialog,
  MarkCollectionViewed,
} from "@/components/library/collection-forms";
import { LibraryView } from "@/components/library/library-view";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { libraryFiltersToSearchParams, parseLibraryFilters } from "@/lib/library-filters";
import { listAssets } from "@/server/assets/asset-queries";
import { getCollection } from "@/server/library/collections";
import { getLibraryOptions } from "@/server/library/options";
import { requireUser } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/collections/[collectionId]">): Promise<Metadata> {
  const { collectionId } = await params;
  if (!z.uuid().safeParse(collectionId).success) return { title: "Collection" };
  return { title: (await getCollection(collectionId))?.name ?? "Collection" };
}

export default async function CollectionPage({ params, searchParams }: PageProps<"/collections/[collectionId]">) {
  await requireUser();
  const { collectionId } = await params;
  if (!z.uuid().safeParse(collectionId).success) notFound();
  const collection = await getCollection(collectionId);
  if (!collection) notFound();

  const filters = { ...parseLibraryFilters(await searchParams), collectionId };
  const [page, options] = await Promise.all([listAssets(filters, { offset: 0 }), getLibraryOptions()]);
  const queryString = libraryFiltersToSearchParams(filters).toString();

  return (
    <>
      <MarkCollectionViewed id={collection.id} />
      <PageHeader
        eyebrow={
          <Link href="/collections" className="hover:text-foreground hover:underline">
            Collections
          </Link>
        }
        title={collection.name}
        description={collection.description ?? undefined}
        actions={
          <>
            <AddToCollectionPicker collectionId={collection.id} />
            <EditCollectionDialog id={collection.id} name={collection.name} description={collection.description} />
            <DeleteCollectionButton id={collection.id} name={collection.name} />
          </>
        }
      />
      <LibraryView
        initialItems={page.items}
        total={page.total}
        filters={filters}
        queryString={queryString}
        options={options}
        locked={{ collectionId }}
        emptyState={
          <EmptyState icon={ImageOff} title="Collection vide">
            Ajoutez des illustrations avec « Choisir dans la bibliothèque », ou depuis la galerie (sélection puis « Collection »).
          </EmptyState>
        }
      />
    </>
  );
}
