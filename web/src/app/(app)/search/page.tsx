import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MasonryGrid } from "@/components/library/masonry-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { GENERATION_STATUS_LABELS } from "@/lib/labels";
import { pluralize } from "@/lib/text";
import { GenerationStatus } from "@/generated/prisma/enums";
import { globalSearch } from "@/server/search/global-search";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Recherche" };

function ResultList({ title, items }: { title: string; items: { href: string; label: string; detail?: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 font-heading text-lg font-semibold">
        {title} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
      </h2>
      <ul className="divide-y rounded-xl border">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex items-center justify-between gap-2 px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring">
              <span className="truncate">{item.label}</span>
              {item.detail ? <span className="text-xs text-muted-foreground">{item.detail}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  await requireUser();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 200) : "";
  const results = await globalSearch(query);
  const others =
    results.characters.length + results.collections.length + results.generations.length + results.briefs.length + results.tags.length;

  return (
    <>
      <PageHeader title={query ? `Recherche : « ${query} »` : "Recherche"} description="Titres, descriptions, notes, tags, collections, personnages, briefs et prompts. Accents et majuscules sont ignorés." />
      {results.terms.length === 0 ? (
        <p className="text-sm text-muted-foreground">Saisissez un terme dans le champ de recherche.</p>
      ) : results.assets.total === 0 && others === 0 ? (
        <EmptyState icon={SearchX} title="Aucun résultat">
          Vérifiez l&apos;orthographe ou essayez un terme plus court.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {results.assets.total > 0 ? (
            <section>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="font-heading text-lg font-semibold">
                  Illustrations <span className="text-sm font-normal text-muted-foreground">({results.assets.total})</span>
                </h2>
                <Link href={`/library?q=${encodeURIComponent(query)}`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                  {results.assets.total > results.assets.items.length ? `Voir les ${pluralize(results.assets.total, "résultat")}` : "Ouvrir dans la bibliothèque"}
                </Link>
              </div>
              <MasonryGrid items={results.assets.items} linkQuery={`?q=${encodeURIComponent(query)}`} />
            </section>
          ) : null}
          <div className="grid gap-8 lg:grid-cols-2">
            <ResultList title="Personnages" items={results.characters.map((item) => ({ href: `/characters/${item.id}`, label: item.name }))} />
            <ResultList title="Collections" items={results.collections.map((item) => ({ href: `/collections/${item.id}`, label: item.name }))} />
            <ResultList
              title="Générations"
              items={results.generations.map((item) => ({
                href: `/generations/${item.id}`,
                label: item.title,
                detail: GENERATION_STATUS_LABELS[item.status as GenerationStatus],
              }))}
            />
            <ResultList title="Briefs" items={results.briefs.map((item) => ({ href: `/workshop/${item.id}`, label: item.title }))} />
            <ResultList title="Tags" items={results.tags.map((item) => ({ href: `/library?tag=${item.id}`, label: item.name }))} />
          </div>
        </div>
      )}
    </>
  );
}
