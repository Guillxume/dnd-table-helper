import { PenLine, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/format";
import { SUBJECT_TYPE_LABELS } from "@/lib/labels";
import { pluralize } from "@/lib/text";
import { listBriefs } from "@/server/briefs/briefs";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Atelier de briefs" };

export default async function WorkshopPage() {
  await requireUser();
  const briefs = await listBriefs();
  const newButton = (
    <Button asChild>
      <Link href="/workshop/new">
        <Plus aria-hidden />
        Nouveau brief
      </Link>
    </Button>
  );
  return (
    <>
      <PageHeader
        title="Atelier de briefs"
        description="Préparez un brief structuré et un prompt prêt à copier dans ChatGPT Images, à partir d'une fiche, d'un guide et de références. Aucune API d'IA n'est appelée."
        actions={newButton}
      />
      {briefs.length === 0 ? (
        <EmptyState icon={PenLine} title="Aucun brief" action={newButton}>
          Un brief assemble la description canonique, la direction artistique et le rôle de chaque référence.
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border">
          {briefs.map((brief) => (
            <li key={brief.id}>
              <Link
                href={`/workshop/${brief.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{brief.title}</span>
                <Badge variant="outline">{SUBJECT_TYPE_LABELS[brief.subjectType]}</Badge>
                {brief.character ? <span className="text-sm text-muted-foreground">{brief.character.name}</span> : null}
                <span className="text-xs text-muted-foreground">
                  {pluralize(brief._count.references, "référence")} · {pluralize(brief._count.generations, "génération")} ·{" "}
                  {formatShortDate(brief.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
