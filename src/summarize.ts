import Anthropic from "@anthropic-ai/sdk";

/** Appelle un modèle : (consigne système, message utilisateur) -> texte. */
export type Completer = (system: string, user: string, maxTokens?: number) => Promise<string>;

export const MAX_NOTES_LENGTH = 4000; // limite d'un champ de formulaire Discord

export const SYSTEM_PROMPT = `Tu aides le maître du jeu d'une campagne de jeu de rôle à rédiger le rappel de la séance précédente, destiné aux joueurs.
Les notes sont classées par rubriques (déroulement, PNJ, lieux, objets, fils ouverts) ; certaines rubriques peuvent être absentes.
Règles :
- Utilise uniquement les informations présentes dans les notes. N'invente aucun fait, nom, lieu ou événement.
- Les notes du MJ font foi. Les notes des joueurs, si elles sont fournies, ne servent qu'à compléter : n'en reprends rien qui contredise les notes du MJ ou qui n'y trouve pas d'appui, et ne les cite pas nommément.
- Si une information est incertaine ou manquante dans les notes, ne la complète pas.
- Écris en français, avec les accents, sur un ton clair et vivant, sans tirets longs.
- Structure : un court résumé de la séance, puis "Points à retenir" (personnages rencontrés, lieux, objets, décisions), puis "Fils ouverts" (ce qui reste à résoudre).
- Longueur maximale : environ 1500 caractères.`;

export interface PlayerNoteInput {
  author: string;
  text: string;
}

export function playerNotesBlock(notes: readonly PlayerNoteInput[]): string {
  if (!notes.length) return "";
  return `Notes des joueurs (complément, moins fiable que les notes du MJ) :\n${notes.map((n) => `- ${n.author} : ${n.text.trim()}`).join("\n")}`;
}

export async function summarizeNotes(complete: Completer, notes: string, style = "", playerNotes: readonly PlayerNoteInput[] = []): Promise<string> {
  const trimmed = notes.trim();
  if (trimmed === "") throw new Error("Les notes de séance sont vides.");
  const players = playerNotesBlock(playerNotes);
  const recap = (await complete(SYSTEM_PROMPT, `${style ? `${style}\n\n` : ""}Notes de séance du MJ :\n\n${trimmed}${players ? `\n\n${players}` : ""}`)).trim();
  if (recap === "") throw new Error("Le modèle n'a renvoyé aucun texte.");
  return recap;
}

export const TRUNCATION_NOTICE =
  "\n\n[Brouillon interrompu : la limite de longueur est atteinte. Relancez avec une demande plus ciblée.]";

/** Texte d'une réponse du modèle ; signale explicitement une réponse coupée par la limite de tokens. */
export function textFromResponse(res: {
  content: readonly { type: string; text?: string }[];
  stop_reason?: string | null;
}): string {
  const text = res.content
    .flatMap((b) => (b.type === "text" && typeof b.text === "string" ? [b.text] : []))
    .join("")
    .trim();
  return res.stop_reason === "max_tokens" && text !== "" ? text + TRUNCATION_NOTICE : text;
}

export interface RawResponse {
  content: readonly { type: string; text?: string }[];
  stop_reason?: string | null;
  stop_details?: unknown;
}
export type RawCall = (system: string, user: string, maxTokens: number) => Promise<RawResponse>;

export const EMPTY_RETRY_NUDGE = "\n\nRéponds maintenant avec le texte demandé, en français.";

/**
 * Appelle le modèle ; si la réponse ne contient aucun texte, journalise la raison d'arrêt et réessaie une fois
 * avec une limite doublée et une consigne explicite. Si elle reste vide, l'erreur indique la raison d'arrêt.
 */
export async function completeWithRetry(call: RawCall, system: string, user: string, maxTokens: number): Promise<string> {
  const first = await call(system, user, maxTokens);
  const text = textFromResponse(first);
  if (text !== "") return text;
  const describe = (r: RawResponse) =>
    `raison d’arrêt : ${r.stop_reason ?? "inconnue"}, blocs : ${r.content.map((b) => b.type).join(", ") || "aucun"}${r.stop_details ? `, détail : ${JSON.stringify(r.stop_details)}` : ""}`;
  console.warn(`Réponse vide du modèle (${describe(first)}). Nouvel essai.`);
  const second = await call(system, user + EMPTY_RETRY_NUDGE, maxTokens * 2);
  const retry = textFromResponse(second);
  if (retry !== "") return retry;
  console.warn(`Réponse vide du modèle au second essai (${describe(second)}).`);
  throw new Error(`Le modèle n’a renvoyé aucun texte (${describe(second)}).`);
}

export function createAnthropicCompleter(apiKey: string, model: string): Completer {
  const client = new Anthropic({ apiKey });
  const call: RawCall = async (system, user, maxTokens) =>
    (await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    })) as unknown as RawResponse;
  return (system, user, maxTokens) => completeWithRetry(call, system, user, maxTokens ?? 1024);
}
