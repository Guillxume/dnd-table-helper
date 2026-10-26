import { Tags } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listTagsWithCounts } from "@/server/library/tags";
import { requireUser } from "@/server/session";
import { TagRow } from "./tag-row";

export const metadata: Metadata = { title: "Tags" };

export default async function TagsPage() {
  await requireUser();
  const tags = await listTagsWithCounts();
  return (
    <>
      <PageHeader
        title="Tags"
        description="Les tags se créent en les ajoutant à une illustration. Renommer un tag le met à jour partout ; deux tags ne peuvent pas porter le même nom (casse et accents ignorés)."
      />
      {tags.length === 0 ? (
        <EmptyState icon={Tags} title="Aucun tag">
          Ajoutez des tags depuis la fiche d&apos;une illustration, à l&apos;import ou par sélection multiple dans la galerie.
        </EmptyState>
      ) : (
        <ul className="max-w-2xl divide-y rounded-xl border">
          {tags.map((tag) => (
            <TagRow key={tag.id} id={tag.id} name={tag.name} count={tag._count.assets} />
          ))}
        </ul>
      )}
    </>
  );
}
