import guideData from "./guide.json" with { type: "json" };
import { splitMessage } from "../text.js";

export interface GuideClass {
  nom: string;
  role: string;
  axes: string;
  sousClasses: { nom: string; orientation: string }[];
  jalons: { niveau: string; change: string; sens: string }[];
  reperes: string;
  planifier: string;
}

interface GuideData {
  source: string;
  overview: Record<string, { style: string; atouts: string; aConsiderer: string; evolution: string }>;
  questions: string[];
  classes: Record<string, GuideClass>;
}

const data = guideData as unknown as GuideData;

export const GUIDE_CLASS_IDS = Object.keys(data.classes);
export const GUIDE_FOOTER =
  "Source : guides d’orientation fournis par le MJ (résumés, hors SRD, non vérifiés par l’assistant). Les capacités exactes sont à lire dans le Manuel des joueurs 2024.";

export function guideClass(id: string): GuideClass | undefined {
  return data.classes[id];
}

export function renderClassGuide(id: string): string[] {
  const c = guideClass(id);
  const o = data.overview[c?.nom ?? ""];
  if (!c) return [];
  const lines = [
    `**${c.nom}**`,
    c.role,
    c.axes,
    ...(o ? [`Atouts : ${o.atouts}`, `À considérer : ${o.aConsiderer}`] : []),
    "",
    "**Sous-classes (niveau 3)**",
    ...c.sousClasses.map((s) => `• ${s.nom} : ${s.orientation}`),
    "",
    "**Jalons indicatifs**",
    ...c.jalons.map((j) => `• Niveau ${j.niveau} : ${j.change}. ${j.sens}`),
    "",
    `**Repères par niveau** : ${c.reperes}`,
    `**Pour planifier** : ${c.planifier}`,
    "",
    `_${GUIDE_FOOTER}_`,
  ];
  return splitMessage(lines.join("\n"));
}

export function renderOverview(): string[] {
  const lines = [
    "**Comparer les 12 classes**",
    ...Object.entries(data.overview).map(([nom, o]) => `• **${nom}** : ${o.style}`),
    "",
    "**Questions pour trouver ton concept**",
    ...data.questions.map((q) => `• ${q}`),
    "",
    "Utilise /guide avec une classe pour le détail (sous-classes, jalons).",
    `_${GUIDE_FOOTER}_`,
  ];
  return splitMessage(lines.join("\n"));
}
