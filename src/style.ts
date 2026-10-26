/** Guide de style d'une campagne : appliqué aux textes rédigés par l'assistant (rappels, préparation, idées). */
export interface StyleGuide {
  tone?: string;
  vocabulary?: string;
  names?: string;
  avoid?: string;
  example?: string;
}

export interface StyleField {
  id: keyof StyleGuide;
  label: string; // 45 caractères max (Discord)
  heading: string;
  placeholder: string; // 100 caractères max (Discord)
}

export const STYLE_MAX = 600;

export const STYLE_FIELDS: readonly StyleField[] = [
  { id: "tone", label: "Ton et narration", heading: "Ton", placeholder: "Ex : sombre et tendu, phrases courtes, présent de narration, vouvoiement des PNJ" },
  { id: "vocabulary", label: "Univers et vocabulaire", heading: "Univers et vocabulaire", placeholder: "Ex : Royaumes oubliés ; dire « la Guilde » et non « les voleurs »" },
  { id: "names", label: "Noms propres et orthographe", heading: "Noms propres (orthographe exacte)", placeholder: "Ex : Phandaline, Gundren Cherchepierre, la Mine perdue de Phancreux" },
  { id: "avoid", label: "À éviter", heading: "À éviter", placeholder: "Ex : humour anachronique, gore détaillé, révéler les secrets du MJ" },
  { id: "example", label: "Exemple de texte dans le bon style", heading: "Exemple de style", placeholder: "Quelques phrases écrites comme tu aimes : l’assistant imitera le ton, pas le contenu" },
];

export function normalizeStyle(raw: unknown): StyleGuide {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: StyleGuide = {};
  for (const f of STYLE_FIELDS) {
    const v = r[f.id];
    if (typeof v === "string" && v.trim()) out[f.id] = v.trim().slice(0, STYLE_MAX);
  }
  return out;
}

export const isEmptyStyle = (g: StyleGuide) => STYLE_FIELDS.every((f) => !g[f.id]);

/** Bloc à ajouter au message envoyé au modèle. Le guide ne peut pas lever les règles d'exactitude. */
export function styleBlock(g: StyleGuide): string {
  if (isEmptyStyle(g)) return "";
  const lines = STYLE_FIELDS.filter((f) => g[f.id]).map((f) => `${f.heading} : ${g[f.id]}`);
  return `Guide de style de la campagne, à suivre pour l'écriture (il ne remplace pas les règles : n'invente toujours rien) :\n${lines.join("\n")}`;
}

export function describeStyle(g: StyleGuide): string {
  if (isEmptyStyle(g)) return "Aucun guide de style pour le moment.";
  return STYLE_FIELDS.filter((f) => g[f.id]).map((f) => `**${f.heading}** : ${g[f.id]}`).join("\n");
}
