import { CheckCircle2, Circle, ImagePlus, PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AssetImage } from "@/components/shared/asset-image";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GENERATION_STATUS_LABELS } from "@/lib/labels";
import { pluralize } from "@/lib/text";
import { cn } from "@/lib/utils";
import { getDashboard } from "@/server/dashboard";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Tableau de bord" };

type Tile = { id: string; title: string; width: number; height: number; dominantColor: string | null };

function TileRow({ items, className }: { items: Tile[]; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6", className)}>
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/library/${item.id}`}
            className="group block aspect-[4/5] overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring"
            title={item.title}
          >
            <AssetImage
              assetId={item.id}
              alt={item.title}
              width={item.width}
              height={item.height}
              dominantColor={item.dominantColor}
              className="h-full transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      {href ? (
        <Link href={href} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          {linkLabel ?? "Tout voir"}
        </Link>
      ) : null}
    </div>
  );
}

export default async function DashboardPage() {
  await requireUser();
  const { stats, recent, favorites, collections, generations, categories } = await getDashboard();

  const steps = [
    { done: stats.assets > 0, label: "Importer vos premières références", href: "/library/import" },
    { done: stats.collections > 0, label: "Regrouper des références dans une collection", href: "/collections" },
    { done: stats.characters > 0, label: "Créer la fiche canonique d'un personnage", href: "/characters/new" },
    { done: stats.styleGuides > 0, label: "Définir un guide de direction artistique", href: "/style-guides" },
    { done: stats.briefs > 0, label: "Préparer un premier brief", href: "/workshop/new" },
    { done: stats.generations > 0, label: "Archiver une génération", href: "/generations/new" },
  ];
  const remaining = steps.filter((step) => !step.done);

  return (
    <>
      <PageHeader
        title="Atelier"
        description={
          <span>
            {pluralize(stats.assets, "illustration")} · {pluralize(stats.favorites, "favori")} ·{" "}
            {pluralize(stats.collections, "collection")} · {pluralize(stats.characters, "personnage")} ·{" "}
            {pluralize(stats.generations, "génération")}
          </span>
        }
        actions={
          <>
            <Button asChild>
              <Link href="/library/import">
                <ImagePlus aria-hidden />
                Importer
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/workshop/new">
                <PenLine aria-hidden />
                Nouveau brief
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-10">
        {remaining.length > 0 ? (
          <section aria-labelledby="start-title" className="rounded-xl border bg-card p-5">
            <h2 id="start-title" className="mb-3 font-heading text-lg font-semibold">
              {stats.assets === 0 ? "Pour commencer" : "Étapes restantes"}
            </h2>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map((step) => (
                <li key={step.href}>
                  <Link
                    href={step.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring",
                      step.done && "text-muted-foreground line-through",
                    )}
                  >
                    {step.done ? (
                      <CheckCircle2 className="size-4 shrink-0 text-primary" aria-label="Fait" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground" aria-label="À faire" />
                    )}
                    {step.label}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {recent.length > 0 ? (
          <section aria-label="Derniers imports">
            <SectionHeader title="Derniers imports" href="/library" linkLabel="Bibliothèque" />
            <TileRow items={recent} />
          </section>
        ) : null}

        {categories.length > 0 ? (
          <section aria-label="Catégories">
            <SectionHeader title="Catégories" href="/categories" linkLabel="Gérer" />
            <ul className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/library?category=${category.id}`}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm outline-none hover:border-primary/50 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
                  >
                    {category.name}
                    <span className="text-xs text-muted-foreground tabular-nums">{category._count.assets}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {favorites.length > 0 ? (
          <section aria-label="Favoris">
            <SectionHeader title="Favoris" href="/library?favorite=1" />
            <TileRow items={favorites} className="lg:grid-cols-8" />
          </section>
        ) : null}

        <div className="grid gap-10 lg:grid-cols-2">
          <section aria-label="Collections récemment consultées">
            <SectionHeader title="Collections récentes" href="/collections" />
            {collections.length === 0 ? (
              <p className="text-sm text-muted-foreground">Les collections que vous ouvrez apparaîtront ici.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {collections.map((collection) => (
                  <li key={collection.id}>
                    <Link href={`/collections/${collection.id}`} className="group block outline-none focus-visible:ring-3 focus-visible:ring-ring">
                      <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                        {collection.cover ? (
                          <AssetImage assetId={collection.cover.id} alt="" width={640} height={480} dominantColor={collection.cover.dominantColor} className="h-full" />
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium group-hover:underline">{collection.name}</p>
                      <p className="text-xs text-muted-foreground">{pluralize(collection._count.assets, "illustration")}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Dernières générations">
            <SectionHeader title="Dernières générations" href="/generations" />
            {generations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune génération archivée.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-3">
                {generations.map((generation) => (
                  <li key={generation.id}>
                    <Link href={`/generations/${generation.id}`} className="group block outline-none focus-visible:ring-3 focus-visible:ring-ring">
                      <div className="aspect-[4/5] overflow-hidden rounded-lg bg-muted">
                        {generation.asset ? (
                          <AssetImage
                            assetId={generation.asset.id}
                            alt={generation.title}
                            width={generation.asset.width}
                            height={generation.asset.height}
                            dominantColor={generation.asset.dominantColor}
                            className="h-full"
                          />
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm group-hover:underline">{generation.title}</p>
                      <Badge variant="outline" className="mt-0.5 text-[0.7rem]">
                        {GENERATION_STATUS_LABELS[generation.status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
