import type { CarnetEntry, CarnetKind, Store } from "./db.js";
import type { Completer } from "./summarize.js";

/**
 * Carnet de campagne : PNJ, lieux, objets et fils ouverts, extraits des rappels publiés.
 * On part du rappel publié (déjà lu par les joueurs) et non des notes du MJ : le carnet ne révèle rien de plus.
 */
export const CARNET_SYSTEM = `Tu tiens le carnet d'une campagne de jeu de rôle à partir du rappel de séance publié pour les joueurs.
Réponds uniquement par un objet JSON, sans texte autour, de la forme :
{"pnj":[{"nom":"...","detail":"..."}],"lieux":[{"nom":"...","detail":"..."}],"objets":[{"nom":"...","detail":"..."}],"fils":[{"nom":"...","detail":"..."}]}
Règles :
- Uniquement ce qui figure explicitement dans le rappel. N'invente rien, ne déduis rien.
- "pnj" : personnages non joueurs nommés. N'y mets pas les personnages des joueurs dont la liste est fournie.
- "lieux" : lieux nommés. "objets" : objets, indices ou récompenses notables.
- "fils" : questions ou objectifs encore en suspens à la fin de la séance ; "nom" est une phrase courte.
- "detail" : une phrase courte en français (rôle, attitude, ce que les personnages en savent), ou "" si le rappel n'en dit rien.
- Recopie les noms exactement comme dans le rappel. Listes vides s'il n'y a rien.`;

export interface CarnetExtract {
  pnj: { nom: string; detail: string }[];
  lieux: { nom: string; detail: string }[];
  objets: { nom: string; detail: string }[];
  fils: { nom: string; detail: string }[];
}

const list = (v: unknown): { nom: string; detail: string }[] =>
  Array.isArray(v)
    ? v.flatMap((x) => {
        if (!x || typeof x !== "object") return [];
        const o = x as Record<string, unknown>;
        const nom = typeof o["nom"] === "string" ? o["nom"].trim().slice(0, 120) : "";
        const detail = typeof o["detail"] === "string" ? o["detail"].trim().slice(0, 300) : "";
        return nom ? [{ nom, detail }] : [];
      })
    : [];

/** Lit la réponse du modèle ; tolère du texte autour de l'objet JSON. Lève une erreur si aucun JSON valide. */
export function parseCarnet(text: string): CarnetExtract {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("réponse sans JSON");
  const data = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  return { pnj: list(data["pnj"]), lieux: list(data["lieux"]), objets: list(data["objets"]), fils: list(data["fils"]) };
}

export async function extractCarnet(complete: Completer, recap: string, playerCharacters: string[]): Promise<CarnetExtract> {
  const user = `Personnages des joueurs (à exclure des PNJ) : ${playerCharacters.join(", ") || "aucun"}\n\nRappel publié :\n\n${recap}`;
  return parseCarnet(await complete(CARNET_SYSTEM, user, 1500));
}

/** Enregistre l'extraction ; retourne un résumé (« 2 PNJ, 1 lieu, 3 fils ouverts »). */
export function applyCarnet(store: Store, campaignId: string, e: CarnetExtract, sessionNumber: number): string {
  for (const x of e.pnj) store.upsertCarnet(campaignId, "pnj", x.nom, x.detail, sessionNumber);
  for (const x of e.lieux) store.upsertCarnet(campaignId, "lieu", x.nom, x.detail, sessionNumber);
  for (const x of e.objets) store.upsertCarnet(campaignId, "objet", x.nom, x.detail, sessionNumber);
  store.replaceOpenThreads(campaignId, e.fils.map((f) => ({ name: f.nom, detail: f.detail })), sessionNumber);
  const parts = [
    [e.pnj.length, "PNJ"],
    [e.lieux.length, e.lieux.length > 1 ? "lieux" : "lieu"],
    [e.objets.length, e.objets.length > 1 ? "objets" : "objet"],
    [e.fils.length, e.fils.length > 1 ? "fils ouverts" : "fil ouvert"],
  ] as const;
  return parts.map(([n, label]) => `${n} ${label}`).join(", ");
}

export const CARNET_TITLES: Record<CarnetKind, string> = {
  pnj: "Personnages rencontrés",
  lieu: "Lieux",
  objet: "Objets, indices et récompenses",
  fil: "Fils ouverts (dernière séance)",
};

const ORDER: CarnetKind[] = ["fil", "pnj", "lieu", "objet"];

export function renderCarnet(campaignName: string, entries: CarnetEntry[]): string {
  if (!entries.length) return `Le carnet de « ${campaignName} » est vide : il se remplit à chaque rappel publié par le MJ.`;
  const lines = [`**Carnet de campagne : ${campaignName}**`];
  for (const kind of ORDER) {
    const of = entries.filter((e) => e.kind === kind);
    if (!of.length) continue;
    lines.push("", `**${CARNET_TITLES[kind]}**`);
    for (const e of of) {
      const when = kind === "fil" ? "" : e.firstSession === e.lastSession ? ` (séance ${e.firstSession})` : ` (séances ${e.firstSession} à ${e.lastSession})`;
      lines.push(`• **${e.name}**${e.detail ? ` : ${e.detail}` : ""}${when}`);
    }
  }
  return lines.join("\n");
}
