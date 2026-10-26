import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { STYLE_ASPECT_LABELS } from "@/lib/labels";
import { changedAspects, mergeGuideRules, rulesToMap } from "@/lib/style/merge-rules";
import { getStyleGuide, listStyleGuideVersions } from "@/server/style-guides/style-guides";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Historique du guide" };

export default async function StyleGuideVersionsPage({ params }: PageProps<"/style-guides/[guideId]/versions">) {
  await requireUser();
  const { guideId } = await params;
  if (!z.uuid().safeParse(guideId).success) notFound();
  const [guide, versions] = await Promise.all([getStyleGuide(guideId), listStyleGuideVersions(guideId)]);
  if (!guide) notFound();

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/style-guides/${guide.id}`} className="hover:text-foreground hover:underline">
            {guide.name}
          </Link>
        }
        title="Historique des versions"
        description="Les versions sont immuables : une génération archivée renvoie toujours à la version exacte utilisée."
      />
      <ol className="max-w-4xl space-y-4">
        {versions.map((version, index) => {
          const rules = rulesToMap(version.rules);
          const previous = versions[index + 1];
          const changes = previous ? changedAspects(rulesToMap(previous.rules), rules) : [];
          return (
            <li key={version.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">Version {version.number}</h2>
                {index === 0 ? <Badge>Actuelle</Badge> : null}
                <span className="text-sm text-muted-foreground">{formatDateTime(version.createdAt)}</span>
              </div>
              {version.changeNote ? <p className="mt-1 text-sm">{version.changeNote}</p> : null}
              {previous ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Modifié : {changes.length > 0 ? changes.map((aspect) => STYLE_ASPECT_LABELS[aspect].toLowerCase()).join(", ") : "aucun aspect"}
                </p>
              ) : null}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-primary">Voir les règles propres à cette version</summary>
                {Object.keys(rules).length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Aucune règle.</p>
                ) : (
                  <dl className="mt-3 space-y-3">
                    {mergeGuideRules(rules, null).map((rule) => (
                      <div key={rule.aspect} className={changes.includes(rule.aspect) ? "border-l-2 border-primary/60 pl-2" : undefined}>
                        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{STYLE_ASPECT_LABELS[rule.aspect]}</dt>
                        <dd className="text-sm whitespace-pre-line">{rule.common}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </details>
            </li>
          );
        })}
      </ol>
    </>
  );
}
