import type { Metadata } from "next";
import { z } from "zod";
import { GenerationForm, type GenerationFormDefaults } from "@/components/generations/generation-parts";
import { PageHeader } from "@/components/shared/page-header";
import { getBrief } from "@/server/briefs/briefs";
import { listCharacterOptions } from "@/server/characters/characters";
import { getUploadMaxBytes } from "@/server/env";
import { getGeneration } from "@/server/generations/generations";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Archiver une génération" };

const EMPTY: GenerationFormDefaults = {
  title: "",
  briefId: null,
  briefTitle: null,
  characterId: null,
  styleGuideVersionId: null,
  styleGuideLabel: null,
  previousId: null,
  previousTitle: null,
  prompt: "",
  references: [],
};

/** Préremplissage depuis un brief (?brief=) ou depuis la version précédente (?from=). */
async function loadDefaults(params: Record<string, string | string[] | undefined>): Promise<GenerationFormDefaults> {
  const fromId = z.uuid().safeParse(params.from).data;
  if (fromId) {
    const previous = await getGeneration(fromId);
    if (previous) {
      return {
        title: `${previous.title} (nouvelle version)`,
        briefId: previous.brief?.id ?? null,
        briefTitle: previous.brief?.title ?? null,
        characterId: previous.character?.id ?? null,
        styleGuideVersionId: previous.styleGuideVersion?.id ?? null,
        styleGuideLabel: previous.styleGuideVersion
          ? `${previous.styleGuideVersion.styleGuide.name} v${previous.styleGuideVersion.number}`
          : null,
        previousId: previous.id,
        previousTitle: previous.title,
        prompt: previous.prompt,
        references: previous.references.map((reference) => ({
          asset: reference.asset,
          role: reference.role,
          aspects: reference.aspects,
          note: reference.note ?? "",
        })),
      };
    }
  }
  const briefId = z.uuid().safeParse(params.brief).data;
  if (briefId) {
    const brief = await getBrief(briefId);
    if (brief) {
      return {
        ...EMPTY,
        title: brief.title,
        briefId: brief.id,
        briefTitle: brief.title,
        characterId: brief.character?.id ?? null,
        styleGuideVersionId: brief.styleGuideVersion?.id ?? null,
        styleGuideLabel: brief.styleGuideVersion
          ? `${brief.styleGuideVersion.styleGuide.name} v${brief.styleGuideVersion.number}`
          : null,
        prompt: brief.prompt,
        references: brief.references.map((reference) => ({
          asset: reference.asset,
          role: reference.role,
          aspects: reference.aspects,
          note: reference.note ?? "",
        })),
      };
    }
  }
  return EMPTY;
}

export default async function NewGenerationPage({ searchParams }: PageProps<"/generations/new">) {
  await requireUser();
  const [defaults, characters] = await Promise.all([loadDefaults(await searchParams), listCharacterOptions()]);
  return (
    <>
      <PageHeader
        title={defaults.previousId ? "Nouvelle version" : "Archiver une génération"}
        description="Importez l'image obtenue et conservez le prompt et les références réellement utilisés."
      />
      <GenerationForm defaults={defaults} characters={characters} maxBytes={getUploadMaxBytes()} />
    </>
  );
}
