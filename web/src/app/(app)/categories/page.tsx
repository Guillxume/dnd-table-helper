import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { listCategories } from "@/server/library/categories";
import { requireUser } from "@/server/session";
import { CategoryRow, NewCategoryForm } from "./category-forms";

export const metadata: Metadata = { title: "Catégories" };

export default async function CategoriesPage() {
  await requireUser();
  const categories = await listCategories();
  const nextOrder = (categories.at(-1)?.sortOrder ?? -10) + 10;
  return (
    <>
      <PageHeader
        title="Catégories"
        description="Une catégorie principale par illustration. Les catégories proposées à l'installation sont de simples suggestions : renommez-les, réordonnez-les ou supprimez-les librement."
      />
      <div className="max-w-3xl space-y-4">
        <NewCategoryForm nextOrder={nextOrder} />
        {categories.length > 0 ? (
          <ul className="divide-y rounded-xl border">
            {categories.map((category) => (
              <CategoryRow
                key={`${category.id}-${category.name}-${category.sortOrder}`}
                category={{ ...category, count: category._count.assets }}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune catégorie pour l&apos;instant.</p>
        )}
      </div>
    </>
  );
}
