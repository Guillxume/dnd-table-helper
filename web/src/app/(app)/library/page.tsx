import { ImagePlus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LibraryView } from "@/components/library/library-view";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { hasActiveFilters, libraryFiltersToSearchParams, parseLibraryFilters } from "@/lib/library-filters";
import { listAssets } from "@/server/assets/asset-queries";
import { getLibraryOptions } from "@/server/library/options";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Bibliothèque" };

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  await requireUser();
  const filters = parseLibraryFilters(await searchParams);
  const [page, options] = await Promise.all([listAssets(filters, { offset: 0 }), getLibraryOptions()]);
  const queryString = libraryFiltersToSearchParams(filters).toString();
  const filtered = hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        title="Bibliothèque"
        description="Toutes vos illustrations de référence et vos générations archivées."
        actions={
          <Button asChild>
            <Link href="/library/import">
              <ImagePlus aria-hidden />
              Importer
            </Link>
          </Button>
        }
      />
      <LibraryView
        initialItems={page.items}
        total={page.total}
        filters={filters}
        queryString={queryString}
        options={options}
        emptyState={
          filtered ? (
            <EmptyState icon={SearchX} title="Aucune illustration ne correspond">
              Élargissez la recherche ou retirez un filtre.
            </EmptyState>
          ) : (
            <EmptyState
              icon={ImagePlus}
              title="La bibliothèque est vide"
              action={
                <Button asChild>
                  <Link href="/library/import">Importer des illustrations</Link>
                </Button>
              }
            >
              Importez vos premières références (JPEG, PNG, WebP ou AVIF) par glisser-déposer.
            </EmptyState>
          )
        }
      />
    </>
  );
}
