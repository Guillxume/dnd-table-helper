import type { Trait } from "../types.js";
import { SRC_DDB_FEATS } from "../sources.js";

export interface Feat {
  id: string;
  name: string;
  category: "Origines" | "Style de combat";
  /** Aptitude(s) du don, citées du SRD. */
  traits: Trait[];
  /** Citation de la description complète pour l'affichage compact. */
  summary: string;
  /** Source si le don ne vient pas du SRD 5.2.1 (texte alors résumé en français depuis cette source). */
  source?: string;
  /** Maîtrises à choisir à l'acquisition du don. */
  choice?: { count: number; from: "artisan" | "instrument" };
}

export const FEATS: Feat[] = [
  {
    id: "doue",
    name: "Doué",
    category: "Origines",
    traits: [],
    summary: "Vous recevez la maîtrise d’une combinaison au choix de trois compétences ou outils.",
  },
  {
    id: "initie-magie",
    name: "Initié à la magie",
    category: "Origines",
    traits: [
      {
        name: "Deux sorts mineurs",
        text: "Vous apprenez deux sorts mineurs de votre choix issus de la liste de sorts du Clerc, du Druide ou du Magicien. L’Intelligence, la Sagesse ou le Charisme est votre caractéristique d’incantation pour les sorts de ce don (décidez laquelle à l’acquisition du don).",
      },
      {
        name: "Sort du 1er niveau",
        text: "Choisissez un sort du 1er niveau dans la même liste de sorts où vous avez choisi les sorts mineurs de ce don. Ce sort est toujours considéré comme préparé pour vous. Vous pouvez le lancer une fois sans dépenser d’emplacement de sort et récupérez cette aptitude en terminant un Repos long. Vous pouvez aussi lancer ce même sort avec vos éventuels emplacements de sort.",
      },
    ],
    summary: "Vous apprenez deux sorts mineurs de votre choix issus de la liste de sorts du Clerc, du Druide ou du Magicien.",
  },
  {
    id: "sauvagerie-martiale",
    name: "Sauvagerie martiale",
    category: "Origines",
    traits: [],
    summary:
      "Une fois par tour, lorsque vous touchez une cible avec une arme, vous pouvez lancer deux fois les dés de dégâts de l’arme et utiliser l’un ou l’autre résultat contre la cible.",
  },
  {
    id: "vigilant",
    name: "Vigilant",
    category: "Origines",
    traits: [
      { name: "Maîtrise de l’Initiative", text: "Lorsque vous jouez l’Initiative, ajoutez votre bonus de maîtrise au jet." },
      {
        name: "Échange d’Initiative",
        text: "Aussitôt après avoir joué l’Initiative, vous pouvez échanger votre Initiative avec celle d’un allié volontaire pour le combat à venir. Un tel échange est impossible si vous-même ou l’allié désigné subissez l’état Neutralisé.",
      },
    ],
    summary: "Lorsque vous jouez l’Initiative, ajoutez votre bonus de maîtrise au jet.",
  },
  {
    id: "archerie",
    name: "Archerie",
    category: "Style de combat",
    traits: [],
    summary: "Vous recevez un bonus de +2 aux jets d’attaque effectués avec des armes à distance.",
  },
  {
    id: "armes-deux-mains",
    name: "Armes à deux mains",
    category: "Style de combat",
    traits: [],
    summary:
      "Lorsque vous lancez les dégâts d’une attaque effectuée avec une arme de corps à corps tenue à deux mains, vous pouvez considérer tous les 1 et 2 obtenus aux dés de dégâts comme des 3. Pour que vous puissiez recevoir ce bénéfice, l’arme doit afficher la propriété Deux mains ou Polyvalente.",
  },
  {
    id: "combat-deux-armes",
    name: "Combat à deux armes",
    category: "Style de combat",
    traits: [],
    summary:
      "Lorsque vous effectuez une attaque supplémentaire résultant de l’emploi d’une arme avec la propriété Légère, vous pouvez ajouter votre modificateur de caractéristique aux dégâts de cette attaque si vous ne l’ajoutiez pas déjà.",
  },
  {
    id: "defense",
    name: "Défense",
    category: "Style de combat",
    traits: [],
    summary: "Tant que vous portez une armure légère, intermédiaire ou lourde, vous recevez un bonus de +1 à la Classe d’armure.",
  },
  {
    id: "bagarreur",
    name: "Bagarreur de taverne",
    category: "Origines",
    source: SRC_DDB_FEATS,
    traits: [
      {
        name: "Frappe renforcée",
        text: "Lorsque vous touchez avec une Attaque à mains nues et infligez des dégâts, vous pouvez infliger 1d4 + votre modificateur de Force. Si vous obtenez 1 à ce dé, vous pouvez le relancer et devez utiliser le nouveau résultat.",
      },
      { name: "Armes improvisées", text: "Vous maîtrisez les armes improvisées." },
      {
        name: "Bousculade",
        text: "Une fois par tour, lorsque vous touchez une cible avec une Attaque à mains nues dans le cadre de l’action Attaque, vous pouvez la repousser de 1,50 m.",
      },
    ],
    summary: "Attaque à mains nues à 1d4 + modificateur de Force, maîtrise des armes improvisées, bousculade de 1,50 m.",
  },
  {
    id: "chanceux",
    name: "Chanceux",
    category: "Origines",
    source: SRC_DDB_FEATS,
    traits: [
      {
        name: "Points de chance",
        text: "Vous disposez d’un nombre de points de chance égal à votre bonus de maîtrise. Vous pouvez en dépenser un lors d’un test d20 pour obtenir l’Avantage, ou lorsqu’une créature vous attaque pour lui imposer le Désavantage. La source ne précise pas quand ces points se récupèrent : voir le Manuel des joueurs 2024.",
      },
    ],
    summary: "Points de chance égaux au bonus de maîtrise : Avantage sur un test d20 ou Désavantage à un attaquant.",
  },
  {
    id: "fabricant",
    name: "Fabricant",
    category: "Origines",
    source: SRC_DDB_FEATS,
    choice: { count: 3, from: "artisan" },
    traits: [
      { name: "Maîtrise d’outils", text: "Vous recevez la maîtrise de trois outils d’artisan différents de votre choix." },
      { name: "Remise", text: "Vous bénéficiez d’une remise de 20 % sur l’achat d’objets non magiques." },
      {
        name: "Artisanat rapide",
        text: "Vous pouvez fabriquer un objet de la table « Artisanat rapide » ; il dure jusqu’à ce que vous terminiez un autre Repos long. La source ne détaille pas cette table : voir le Manuel des joueurs 2024.",
      },
    ],
    summary: "Maîtrise de trois outils d’artisan, remise de 20 % sur les objets non magiques, artisanat rapide.",
  },
  {
    id: "guerisseur",
    name: "Guérisseur",
    category: "Origines",
    source: SRC_DDB_FEATS,
    traits: [
      {
        name: "Soins de terrain",
        text: "Lorsque vous utilisez une trousse de soins par une action, une créature peut dépenser un de ses dés de vie pour récupérer des points de vie ; ajoutez votre bonus de maîtrise au résultat.",
      },
      {
        name: "Relance des soins",
        text: "Lorsque vous lancez un dé pour rendre des points de vie avec un sort ou avec cette aptitude, vous pouvez relancer un 1 et devez utiliser le nouveau résultat.",
      },
    ],
    summary: "Soins avec une trousse de soins et un dé de vie, bonus de maîtrise ajouté, relance des 1 aux soins.",
  },
  {
    id: "musicien",
    name: "Musicien",
    category: "Origines",
    source: SRC_DDB_FEATS,
    choice: { count: 3, from: "instrument" },
    traits: [
      { name: "Instruments", text: "Vous recevez la maîtrise de trois instruments de musique de votre choix." },
      {
        name: "Chant d’encouragement",
        text: "À la fin d’un Repos court ou long, vous pouvez jouer d’un instrument que vous maîtrisez pour donner l’Inspiration héroïque à un nombre d’alliés égal à votre bonus de maîtrise.",
      },
    ],
    summary: "Maîtrise de trois instruments ; après un repos, Inspiration héroïque à des alliés (nombre = bonus de maîtrise).",
  },
  {
    id: "robuste",
    name: "Robuste",
    category: "Origines",
    source: SRC_DDB_FEATS,
    traits: [
      {
        name: "Points de vie",
        text: "Lorsque vous recevez ce don, votre maximum de points de vie augmente du double de votre niveau de personnage, puis de 2 à chaque niveau supplémentaire.",
      },
    ],
    summary: "Maximum de points de vie augmenté de 2 par niveau de personnage.",
  },
];

export function getFeat(id: string): Feat | undefined {
  return FEATS.find((f) => f.id === id);
}

export const ORIGIN_FEATS = FEATS.filter((f) => f.category === "Origines");
export const FIGHTING_STYLE_FEATS = FEATS.filter((f) => f.category === "Style de combat");
