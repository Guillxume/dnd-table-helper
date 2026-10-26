import type { Metadata } from "next";
import { z } from "zod";
import { BriefParamsForm } from "@/components/workshop/brief-forms";
import { PageHeader } from "@/components/shared/page-header";
import { getBriefFormOptions } from "@/server/briefs/brief-form-data";
import { requireUser } from "@/server/session";
import { createBriefAction } from "../actions";

export const metadata: Metadata = { title: "Nouveau brief" };

export default async function NewBriefPage({ searchParams }: PageProps<"/workshop/new">) {
  await requireUser();
  const params = await searchParams;
  const options = await getBriefFormOptions();
  const pick = (value: unknown, ids: string[]) =>
    typeof value === "string" && z.uuid().safeParse(value).success && ids.includes(value) ? value : null;
  const characterId = pick(params.character, options.characters.map((character) => character.id));
  const styleGuideId = pick(params.guide, options.guides.map((guide) => guide.id));
  const character = options.characters.find((item) => item.id === characterId);

  return (
    <>
      <PageHeader
        title="Nouveau brief"
        description="Choisissez le sujet, la direction artistique et les références : le brief et le prompt sont générés puis entièrement modifiables."
      />
      <BriefParamsForm
        action={createBriefAction}
        defaults={{
          title: character?.name ?? "",
          subjectType: character?.kind === "CREATURE" ? "CREATURE" : character?.kind === "NPC" ? "NPC" : "CHARACTER",
          characterId,
          styleGuideId,
        }}
        characters={options.characters}
        guides={options.guides}
        submitLabel="Générer le brief"
        cancelHref="/workshop"
      />
    </>
  );
}
