import type { Skill } from "../types.js";

export const SKILLS: Skill[] = [
  { name: "Acrobaties", ability: "DEX" },
  { name: "Arcanes", ability: "INT" },
  { name: "Athlétisme", ability: "FOR" },
  { name: "Discrétion", ability: "DEX" },
  { name: "Dressage", ability: "SAG" },
  { name: "Escamotage", ability: "DEX" },
  { name: "Histoire", ability: "INT" },
  { name: "Intimidation", ability: "CHA" },
  { name: "Intuition", ability: "SAG" },
  { name: "Investigation", ability: "INT" },
  { name: "Médecine", ability: "SAG" },
  { name: "Nature", ability: "INT" },
  { name: "Perception", ability: "SAG" },
  { name: "Persuasion", ability: "CHA" },
  { name: "Religion", ability: "INT" },
  { name: "Représentation", ability: "CHA" },
  { name: "Survie", ability: "SAG" },
  { name: "Tromperie", ability: "CHA" },
];

export const SKILL_NAMES = SKILLS.map((s) => s.name);

/** Langues courantes (tirage ou choix). Le Commun est connu de tous. */
export const COMMON_LANGUAGES = [
  "Draconique",
  "Elfique",
  "Gigant",
  "Gnome",
  "Gobelin",
  "Halfelin",
  "Langue multiverselle des signes",
  "Nain",
  "Orc",
];

export const RARE_LANGUAGES = [
  "Abyssal",
  "Céleste",
  "Druidique",
  "Infernal",
  "Profond",
  "Primordial",
  "Sylvestre",
  "Commun des profondeurs",
  "Argot des voleurs",
];

export const ARTISAN_TOOLS = [
  "Matériel d’alchimiste",
  "Matériel de brasseur",
  "Matériel de calligraphe",
  "Matériel de peintre",
  "Outils de bricoleur",
  "Outils de cartographe",
  "Outils de charpentier",
  "Outils de cordonnier",
  "Outils de forgeron",
  "Outils de joaillier",
  "Outils de maçon",
  "Outils de menuisier",
  "Outils de potier",
  "Outils de souffleur de verre",
  "Outils de tanneur",
  "Outils de tisserand",
  "Ustensiles de cuisinier",
];

export const MUSICAL_INSTRUMENTS = [
  "Chalemie",
  "Cor",
  "Cornemuse",
  "Flûte",
  "Flûte de pan",
  "Luth",
  "Lyre",
  "Tambour",
  "Tympanon",
  "Viole",
];

export const GAMING_SETS = ["Cartes à jouer", "Dés", "Échecs draconiques", "Jeu des dragons"];

/** Contenu des paquetages d'équipement (SRD 5.2.1, section Équipement). */
export const PACKS: Record<string, string[]> = {
  explorateur: [
    "Sac à dos",
    "Sac de couchage",
    "Boîte à amadou",
    "Corde",
    "2 flasques d’huile",
    "10 jours de rations",
    "Outre",
    "10 torches",
  ],
  "exploration souterraine": [
    "Sac à dos",
    "Boîte à amadou",
    "Chausse-trappes",
    "Corde",
    "2 flasques d’huile",
    "10 jours de rations",
    "Outre",
    "Pied-de-biche",
    "10 torches",
  ],
  érudit: [
    "Sac à dos",
    "Boîte à amadou",
    "Encre",
    "Lampe",
    "Livre",
    "Porte-plume",
    "10 flasques d’huile",
    "10 feuilles de parchemin",
  ],
  artiste: [
    "Sac à dos",
    "Boîte à amadou",
    "Cloche",
    "3 costumes",
    "8 flasques d’huile",
    "9 jours de rations",
    "Lanterne sourde",
    "Miroir",
    "Outre",
    "Sac de couchage",
  ],
  ecclésiastique: [
    "Sac à dos",
    "Boîte à amadou",
    "Couverture",
    "Eau bénite",
    "Lampe",
    "7 jours de rations",
    "Robe",
  ],
  cambrioleur: [
    "Sac à dos",
    "Billes",
    "Boîte à amadou",
    "10 bougies",
    "Cloche",
    "Corde",
    "7 flasques d’huile",
    "Lanterne à capote",
    "Outre",
    "Pied-de-biche",
    "5 jours de rations",
  ],
};

export const MASTERIES: Record<string, string> = {
  "Coup double":
    "Lorsque vous effectuez l’attaque supplémentaire de la propriété Légère de l’arme, vous pouvez l’effectuer dans le cadre de l’action Attaque au lieu de devoir y consacrer votre action Bonus. Vous ne pouvez effectuer cette attaque supplémentaire qu’une seule fois par tour.",
  Écorchure:
    "Si votre jet d’attaque avec cette arme rate une créature, vous pouvez lui infliger des dégâts égaux au modificateur de la caractéristique utilisée pour effectuer le jet d’attaque. Ces dégâts sont du même type que ceux infligés par l’arme, et ne peuvent être augmentés qu’en augmentant le modificateur de caractéristique.",
  Enchaînement:
    "Si vous touchez une créature avec un jet d’attaque de corps à corps avec cette arme, vous pouvez effectuer un jet d’attaque de corps à corps avec cette arme contre une deuxième créature située dans un rayon de 1,50 m de la première, et qui est elle aussi à votre portée. Si l’attaque touche, la deuxième créature subit les dégâts de l’arme, mais sans ajouter votre modificateur de caractéristique à ces dégâts, sauf si ce modificateur est négatif. Vous ne pouvez effectuer cette attaque supplémentaire qu’une seule fois par tour.",
  Ouverture:
    "Si vous touchez une créature avec cette arme et lui infligez des dégâts, vous avez l’Avantage à votre prochain jet d’attaque contre cette créature avant la fin de votre tour suivant.",
  Poussée:
    "Si vous touchez une créature avec cette arme, vous pouvez la repousser d’un maximum de 3 m en ligne droite pour peu qu’elle soit de taille G ou inférieure.",
  Ralentissement:
    "Si vous touchez une créature avec cette arme et lui infligez des dégâts, vous pouvez réduire sa Vitesse de 3 m jusqu’au début de votre tour suivant. Si la créature est touchée plus d’une fois par des armes dotées de cette propriété, la réduction de sa Vitesse n’excède pas 3 m.",
  Renversement:
    "Si vous touchez une créature avec cette arme, vous pouvez la contraindre à effectuer un jet de sauvegarde de Constitution (DD égal à 8 + le modificateur de caractéristique utilisé pour le jet d’attaque + votre bonus de maîtrise). En cas d’échec, la créature subit l’état À terre.",
  Sape: "Si vous touchez une créature avec cette arme, cette créature subit le Désavantage à son prochain jet d’attaque avant le début de votre tour suivant.",
};
