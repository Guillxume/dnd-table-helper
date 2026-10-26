/** Aide adaptée au rôle : chacun ne voit que les commandes qu'il peut utiliser. */
export type Audience = "tous" | "mj" | "admin";

export interface HelpEntry {
  command: string;
  text: string;
  who: Audience;
  group: string;
}

export const HELP: HelpEntry[] = [
  { group: "Personnages", who: "tous", command: "/personnage creer nom:<nom>", text: "Crée ton personnage pas à pas. Sans nom, reprend la création en cours." },
  { group: "Personnages", who: "tous", command: "/personnage voir", text: "Ta fiche dans Discord, avec le détail des calculs." },
  { group: "Personnages", who: "tous", command: "/personnage fiche", text: "Ta feuille de personnage en PDF." },
  { group: "Personnages", who: "tous", command: "/personnage liste", text: "Liste les personnages du serveur et leurs numéros." },
  { group: "Personnages", who: "tous", command: "/personnage actif numero:<n>", text: "Choisit ton personnage actif, utilisé par défaut par voir et fiche." },
  { group: "Personnages", who: "tous", command: "/personnage supprimer numero:<n>", text: "Supprime une de tes fiches (avec confirmation)." },
  { group: "Règles et aide au jeu", who: "tous", command: "/guide [classe]", text: "Compare les 12 classes ou en détaille une." },
  { group: "Règles et aide au jeu", who: "tous", command: "/objet nom:<objet>", text: "Fiche d’une arme, d’une armure, d’un outil ou d’un objet (autocomplétion)." },
  { group: "Règles et aide au jeu", who: "tous", command: "/regles", text: "Affiche les paramètres de création de personnage fixés par le MJ." },
  { group: "Règles et aide au jeu", who: "tous", command: "/chercher terme:<texte>", text: "Sort, objet, créature, espèce, historique, classe, règle : SRD et documents du MJ." },
  { group: "Campagne", who: "tous", command: "/carnet voir", text: "Personnages, lieux, objets et fils ouverts de la campagne, tirés des rappels." },
  { group: "Campagne", who: "tous", command: "/rappel", text: "Affiche le rappel de la dernière séance." },
  { group: "Campagne", who: "tous", command: "/prochaine-seance", text: "Date de la prochaine séance, affichée dans ton fuseau horaire." },
  { group: "Campagne", who: "mj", command: "/prochaine-seance date:<JJ/MM/AAAA> heure:<20:30> [note]", text: "Fixe la séance : annonce, puis rappel 24 h avant. Option annuler." },
  { group: "Campagne", who: "mj", command: "/campagne exporter", text: "PDF à imprimer : tous les rappels, puis les fiches." },
  { group: "Campagne", who: "tous", command: "/style voir", text: "Guide de style de la campagne (ton, vocabulaire, noms propres)." },
  { group: "Campagne", who: "mj", command: "/style modifier", text: "Guide de style suivi par l’assistant (rappels, préparation, idées)." },
  { group: "Campagne", who: "tous", command: "/campagne liste", text: "Liste les campagnes du serveur et indique celles où tu joues ou es MJ." },
  { group: "Campagne", who: "tous", command: "/campagne infos", text: "Détails d’une campagne : salons, rôles, personnages, paramètres de création." },
  { group: "Campagne", who: "mj", command: "/campagne ajouter-joueur joueur:<@membre>", text: "Ajoute un joueur, qui reçoit un message d’accueil." },
  { group: "Campagne", who: "mj", command: "/campagne retirer-joueur joueur:<@membre>", text: "Retire le rôle Joueurs (les personnages sont conservés)." },
  { group: "Campagne", who: "mj", command: "/campagne configurer joueurs:<@rôle>", text: "Rattache un rôle Joueurs existant à une ancienne campagne." },
  { group: "Campagne", who: "mj", command: "/campagne archiver campagne:<nom>", text: "Range les salons dans Archives (lecture seule), supprime catégorie et rôles. Les données restent." },
  { group: "Personnages", who: "mj", command: "/personnage voir|fiche joueur:<@joueur>", text: "Consulte la fiche ou le PDF du personnage actif d’un joueur." },
  { group: "Personnages", who: "mj", command: "/personnage supprimer numero:<n>", text: "Supprime n’importe quelle fiche du serveur." },
  { group: "Campagne", who: "mj", command: "/seance", text: "Tes notes de séance : le bot propose un rappel à relire." },
  { group: "Campagne", who: "mj", command: "/preparer type:<scène|PNJ|rencontre>", text: "Brouillon privé de scène, de PNJ ou de rencontre." },
  { group: "Campagne", who: "mj", command: "/regles niveau standard achat des table contenu echeance", text: "Fixe les paramètres de création et l’échéance des personnages (relances à J-3 et J-1)." },
  { group: "Campagne", who: "mj", command: "/campagne panneau|groupe|suivi", text: "Republie les tableaux de bord, fiche de groupe en PDF, avancement des personnages." },
  { group: "Campagne", who: "mj", command: "/rencontre creatures:<liste>", text: "Budget de PX d’une rencontre (SRD) et blocs de statistiques à imprimer." },
  { group: "Campagne", who: "mj", command: "/carnet retirer entree:<entrée>", text: "Retire une entrée erronée du carnet." },
  { group: "Administration", who: "admin", command: "/campagne creer nom:<nom> [mj:<@membre>] [public]", text: "Crée une campagne : catégorie, salons privés, rôles MJ et Joueurs, tableaux de bord." },
  { group: "Administration", who: "admin", command: "/setup nom:<nom>", text: "Comme /campagne creer, relançable sans doublons." },
  { group: "Administration", who: "admin", command: "/campagne reactiver campagne:<nom>", text: "Réactive une campagne archivée." },
  { group: "Administration", who: "admin", command: "/campagne supprimer campagne:<nom>", text: "Supprime tout (salons, rôles, rappels, personnages), après confirmation." },
];

export function audienceOf(isAdmin: boolean, isMj: boolean): Audience[] {
  if (isAdmin) return ["tous", "mj", "admin"];
  if (isMj) return ["tous", "mj"];
  return ["tous"];
}

export function renderHelp(isAdmin: boolean, isMj: boolean, campaigns: string[] = []): string {
  const who = audienceOf(isAdmin, isMj);
  const role = isAdmin ? "administrateur" : isMj ? "MJ" : "joueur";
  const entries = HELP.filter((h) => who.includes(h.who));
  const groups = [...new Set(entries.map((e) => e.group))];
  const lines = [
    `**Commandes disponibles pour toi (${role})**`,
    campaigns.length ? `Tes campagnes : ${campaigns.join(", ")}.` : "Tu ne fais encore partie d’aucune campagne : demande au MJ de t’ajouter.",
    "Le plus simple : les boutons du tableau de bord épinglé dans le salon de rappel de ta campagne (et dans #aide-mj pour le MJ).",
    "Quand plusieurs campagnes existent, ajoute l’option `campagne` ; dans les salons d’une campagne, elle est choisie automatiquement.",
  ];
  for (const g of groups) {
    lines.push("", `**${g}**`);
    for (const e of entries.filter((x) => x.group === g)) lines.push(`• \`${e.command}\` : ${e.text}`);
  }
  lines.push("", "Pendant la création d’un personnage, chaque étape propose « Détails des options », et pour les sorts « Conseil de l’assistant ».");
  return lines.join("\n");
}
