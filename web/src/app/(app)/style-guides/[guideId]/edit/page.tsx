import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { RulesForm } from "@/components/style-guides/style-guide-parts";
import { PageHeader } from "@/components/shared/page-header";
import { rulesToMap } from "@/lib/style/merge-rules";
import { getStyleGuide } from "@/server/style-guides/style-guides";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Modifier les règles" };

export default async function EditStyleGuidePage({ params }: PageProps<"/style-guides/[guideId]/edit">) {
  await requireUser();
  const { guideId } = await params;
  if (!z.uuid().safeParse(guideId).success) notFound();
  const guide = await getStyleGuide(guideId);
  if (!guide) notFound();
  return (
    <>
      <PageHeader
        title={`Règles : ${guide.name}`}
        description={`Version actuelle : ${guide.version?.number ?? 1}. L'enregistrement crée une nouvelle version ; les précédentes restent consultables et les générations gardent la version utilisée.`}
      />
      <RulesForm
        guideId={guide.id}
        ownRules={guide.ownRules}
        inheritedRules={guide.parentVersion ? rulesToMap(guide.parentVersion.rules) : null}
        parentName={guide.parent?.name ?? null}
      />
    </>
  );
}
