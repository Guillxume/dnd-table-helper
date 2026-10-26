import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BriefParamsForm } from "@/components/workshop/brief-forms";
import { PageHeader } from "@/components/shared/page-header";
import { getBriefFormOptions } from "@/server/briefs/brief-form-data";
import { getBrief } from "@/server/briefs/briefs";
import { requireUser } from "@/server/session";
import { updateBriefParamsAction } from "../../actions";

export const metadata: Metadata = { title: "Paramètres du brief" };

export default async function EditBriefPage({ params }: PageProps<"/workshop/[briefId]/edit">) {
  await requireUser();
  const { briefId } = await params;
  if (!z.uuid().safeParse(briefId).success) notFound();
  const [brief, options] = await Promise.all([getBrief(briefId), getBriefFormOptions()]);
  if (!brief) notFound();

  return (
    <>
      <PageHeader title={`Paramètres : ${brief.title}`} />
      <BriefParamsForm
        action={updateBriefParamsAction.bind(null, brief.id)}
        regenerateWarning
        defaults={{
          ...brief,
          characterId: brief.character?.id ?? null,
          styleGuideId: brief.styleGuideVersion?.styleGuide.id ?? null,
          references: brief.references.map((reference) => ({
            asset: reference.asset,
            role: reference.role,
            aspects: reference.aspects,
            note: reference.note ?? "",
          })),
        }}
        characters={options.characters}
        guides={options.guides}
        submitLabel="Enregistrer et régénérer"
        cancelHref={`/workshop/${brief.id}`}
      />
    </>
  );
}
