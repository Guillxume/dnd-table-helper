import { Palette } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NewStyleGuideDialog } from "@/components/style-guides/style-guide-parts";
import { AssetImage } from "@/components/shared/asset-image";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { pluralize } from "@/lib/text";
import { listStyleGuides } from "@/server/style-guides/style-guides";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Direction artistique" };

type GuideSummary = Awaited<ReturnType<typeof listStyleGuides>>[number];

function GuideCard({ guide, variant = false }: { guide: Omit<GuideSummary, "variants">; variant?: boolean }) {
  const version = guide.versions[0];
  return (
    <Link
      href={`/style-guides/${guide.id}`}
      className="group flex gap-4 rounded-xl border bg-card p-3 outline-none transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring"
    >
      <div className="grid size-20 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-lg bg-muted">
        {guide.references.map((reference) => (
          <AssetImage
            key={reference.asset.id}
            assetId={reference.asset.id}
            alt=""
            width={40}
            height={40}
            dominantColor={reference.asset.dominantColor}
            className="h-full"
          />
        ))}
      </div>
      <div className="min-w-0 space-y-1">
        <p className="truncate font-heading text-lg font-semibold group-hover:underline">
          {variant ? <span className="text-muted-foreground">Variante · </span> : null}
          {guide.name}
        </p>
        {guide.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{guide.description}</p> : null}
        <p className="text-xs text-muted-foreground">
          Version {version?.number ?? 1} · {pluralize(version?._count.rules ?? 0, "aspect défini", "aspects définis")} ·{" "}
          {pluralize(guide._count.references, "référence")}
        </p>
      </div>
    </Link>
  );
}

export default async function StyleGuidesPage() {
  await requireUser();
  const guides = await listStyleGuides();
  const parents = guides.map((guide) => ({ id: guide.id, name: guide.name }));
  return (
    <>
      <PageHeader
        title="Direction artistique"
        description="Un référentiel réutilisable : règles par aspect (style, éclairage, matières…), références illustrant chaque aspect, et variantes qui conservent les règles communes. Chaque modification crée une version."
        actions={<NewStyleGuideDialog parents={parents} />}
      />
      {guides.length === 0 ? (
        <EmptyState icon={Palette} title="Aucun guide" action={<NewStyleGuideDialog parents={parents} />}>
          Commencez par un guide principal (ex. « Fantasy peinte »), puis ajoutez des variantes (fantasy sombre, cartes de bataille…).
        </EmptyState>
      ) : (
        <ul className="space-y-6">
          {guides.map((guide) => (
            <li key={guide.id} className="space-y-3">
              <GuideCard guide={guide} />
              {guide.variants.length > 0 ? (
                <ul className="ml-6 grid gap-3 border-l pl-6 lg:grid-cols-2">
                  {guide.variants.map((variant) => (
                    <li key={variant.id}>
                      <GuideCard guide={variant} variant />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
