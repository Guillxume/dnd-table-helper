import type { Ability, Trait } from "../types.js";
import { SRC_ROLL20_AASIMAR } from "../sources.js";

export interface SpeciesOption {
  id: string;
  name: string;
  /** Citation du SRD décrivant le bénéfice de niveau 1. */
  text: string;
  /** Sorts mineurs accordés. */
  cantrips?: string[];
  /** Sort toujours préparé (niveau 1), le cas échéant. */
  alwaysPrepared?: string[];
  /** Résistance accordée (ex. « feu »). */
  resistance?: string;
  /** Vitesse de base en mètres, si l'option la modifie. */
  speed?: number;
  /** Portée de la Vision dans le noir en mètres, si l'option la modifie. */
  darkvision?: number;
  /** Texte reformulé à partir d'une table du SRD (non cité mot pour mot). */
  derived?: boolean;
}

export interface Species {
  id: string;
  name: string;
  /** Tailles possibles ; si deux, le joueur choisit. */
  sizes: ("M" | "P")[];
  sizeText: string;
  /** Vitesse en mètres. */
  speed: number;
  darkvision?: number;
  traits: Trait[];
  /** Titre du choix d'option (ascendance, lignage, héritage). */
  optionLabel?: string;
  options?: SpeciesOption[];
  /** Le joueur choisit INT, SAG ou CHA pour les sorts du trait. */
  optionSpellAbility?: boolean;
  /** Choix d'une compétence parmi cette liste (null = au choix parmi toutes). */
  skillChoice?: { trait: string; from: string[] | null };
  /** Choix d'un don d'origine (humain). */
  originFeatChoice?: boolean;
  /** Points de vie supplémentaires au niveau 1 (Ténacité naine). */
  bonusHp?: number;
  /** Résistances aux dégâts accordées par l'espèce. */
  resistances?: string[];
  /** Sort mineur connu avec une caractéristique d'incantation imposée. */
  innateCantrip?: { name: string; ability: Ability };
  /** Source si l'espèce ne vient pas du SRD 5.2.1 (traits alors traduits depuis cette source). */
  source?: string;
}

const DARK = (m: number): Trait => ({
  name: "Vision dans le noir",
  text: `Vous disposez de la Vision dans le noir sur ${m} m.`,
});

export const SPECIES: Species[] = [
  {
    id: "aasimar",
    name: "Aasimar",
    source: SRC_ROLL20_AASIMAR,
    sizes: ["M", "P"],
    sizeText: "M (environ 1,20 m à 2,10 m) ou P (environ 60 cm à 1,20 m), à choisir lors de la sélection de l’espèce",
    speed: 9,
    darkvision: 18,
    resistances: ["nécrotiques", "radiants"],
    innateCantrip: { name: "Lumière", ability: "CHA" },
    traits: [
      { name: "Résistance céleste", text: "Vous bénéficiez de la Résistance aux dégâts nécrotiques et aux dégâts radiants." },
      DARK(18),
      {
        name: "Mains guérisseuses",
        text: "Par une action Magie, vous touchez une créature et lancez un nombre de d4 égal à votre bonus de maîtrise. La créature récupère autant de points de vie que le total obtenu. Vous ne pouvez plus utiliser ce trait avant d’avoir terminé un Repos long.",
      },
      { name: "Porteur de lumière", text: "Vous connaissez le sort mineur lumière. Le Charisme est votre caractéristique d’incantation pour ce sort." },
      {
        name: "Révélation céleste (à partir du niveau 3)",
        text: "Par une action Bonus, une fois par Repos long, vous vous transformez pendant 1 minute (ou jusqu’à ce que vous y mettiez fin). Pendant la transformation, une fois par tour, vous pouvez infliger des dégâts supplémentaires égaux à votre bonus de maîtrise quand vous infligez des dégâts à une cible avec une attaque ou un sort (nécrotiques avec Voile nécrotique, radiants sinon). Ailes célestes : vitesse de vol égale à votre Vitesse. Rayonnement intérieur : Lumière vive sur 3 m et Lumière faible sur 3 m de plus ; à la fin de chacun de vos tours, les créatures à 3 m ou moins subissent des dégâts radiants égaux à votre bonus de maîtrise. Voile nécrotique : les créatures à 3 m ou moins, hormis vos alliés, doivent réussir un jet de sauvegarde de Charisme (DD 8 + modificateur de Charisme + bonus de maîtrise) ou subir l’état Effrayé jusqu’à la fin de votre tour suivant.",
      },
    ],
  },
  {
    id: "drakeide",
    name: "Drakéide",
    sizes: ["M"],
    sizeText: "M (moyenne, entre 1,50 m et 2,10 m)",
    speed: 9,
    darkvision: 18,
    optionLabel: "Ancêtre draconique",
    options: [
      ["airain", "Airain", "feu"],
      ["argent", "Argent", "froid"],
      ["blanc", "Blanc", "froid"],
      ["bleu", "Bleu", "foudre"],
      ["bronze", "Bronze", "foudre"],
      ["cuivre", "Cuivre", "acide"],
      ["noir", "Noir", "acide"],
      ["or", "Or", "feu"],
      ["rouge", "Rouge", "feu"],
      ["vert", "Vert", "poison"],
    ].map(([id, name, dmg]) => ({
      id: id as string,
      name: name as string,
      text: `Dragon ${(name as string).toLowerCase()} : dégâts de type ${dmg}.`,
      resistance: dmg as string,
      derived: true,
    })),
    traits: [
      {
        name: "Ascendance draconique",
        text: "Votre lignée remonte à un géniteur dragon. Choisissez le type de dragon dans la table « Ancêtres draconiques ». Ce choix affecte vos traits Souffle et Résistance aux dégâts, ainsi que votre apparence.",
      },
      {
        name: "Résistance aux dégâts",
        text: "Vous bénéficiez de la résistance au type de dégâts déterminé par votre trait Ascendance draconique.",
      },
      {
        name: "Souffle",
        text: "Lorsque vous entreprenez l’action Attaque à votre tour, vous pouvez remplacer l’une de vos attaques par une expiration d’énergie magique sous la forme d’un Cône de 4,50 m ou d’une Ligne de 9 m de long et 1,50 m de large (choisissez la forme à chaque fois). Chaque créature prise dans la zone effectue un jet de sauvegarde de Dextérité (DD 8 + votre modificateur de Constitution + votre bonus de maîtrise). En cas d’échec, la créature subit 1d10 dégâts du type déterminé par votre trait Ascendance draconique. En cas de réussite, elle ne subit que la moitié de ces dégâts. Vous pouvez recourir à ce Souffle autant de fois que votre bonus de maîtrise, et récupérez ce quota en terminant un Repos long.",
      },
      DARK(18),
    ],
  },
  {
    id: "elfe",
    name: "Elfe",
    sizes: ["M"],
    sizeText: "M (moyenne, entre 1,50 m et 1,80 m)",
    speed: 9,
    darkvision: 18,
    optionLabel: "Lignage elfique",
    optionSpellAbility: true,
    skillChoice: { trait: "Sens aiguisés", from: ["Intuition", "Perception", "Survie"] },
    options: [
      {
        id: "drow",
        name: "Drow",
        text: "La portée de votre Vision dans le noir passe à 36 m. Vous connaissez également le sort mineur lumières dansantes.",
        cantrips: ["Lumières dansantes"],
        darkvision: 36,
      },
      {
        id: "sylvestre",
        name: "Elfe sylvestre",
        text: "Votre Vitesse passe à 10,50 m. Vous connaissez également le sort mineur druidisme.",
        cantrips: ["Druidisme"],
        speed: 10.5,
      },
      {
        id: "haut-elfe",
        name: "Haut-elfe",
        text: "Vous connaissez le sort mineur prestidigitation. Chaque fois que vous terminez un Repos long, vous pouvez remplacer ce sort mineur par un autre sort mineur de la liste de sorts du Magicien.",
        cantrips: ["Prestidigitation"],
      },
    ],
    traits: [
      {
        name: "Ascendance féerique",
        text: "Vous avez l’Avantage aux jets de sauvegarde visant à éviter l’état Charmé ou à y mettre un terme.",
      },
      {
        name: "Lignage elfique",
        text: "Vous appartenez à un lignage qui vous octroie des aptitudes surnaturelles. Choisissez-en un dans la table « Lignages elfiques ». Vous recevez le bénéfice du niveau 1 de ce lignage.",
      },
      {
        name: "Sens aiguisés",
        text: "Vous bénéficiez de la maîtrise de la compétence Intuition, Perception ou Survie au choix.",
      },
      {
        name: "Transe",
        text: "Vous vous passez de sommeil et la magie ne peut pas vous endormir. Vous pouvez terminer un Repos long en 4 heures si vous les passez en transe méditative durant laquelle vous restez en éveil.",
      },
      DARK(18),
    ],
  },
  {
    id: "gnome",
    name: "Gnome",
    sizes: ["P"],
    sizeText: "P (petite, entre 90 cm et 1,20 m)",
    speed: 9,
    darkvision: 18,
    optionLabel: "Lignage gnome",
    optionSpellAbility: true,
    options: [
      {
        id: "forets",
        name: "Gnome des forêts",
        text: "Vous connaissez le sort mineur illusion mineure. Le sort communication avec les animaux est en outre considéré pour vous comme toujours préparé. Vous pouvez le lancer sans emplacement de sort autant de fois que votre bonus de maîtrise, et récupérez ce quota en terminant un Repos long. Vous pouvez en outre dépenser les emplacements de sort adaptés dont vous disposez pour lancer ce sort.",
        cantrips: ["Illusion mineure"],
        alwaysPrepared: ["Communication avec les animaux"],
      },
      {
        id: "roches",
        name: "Gnome des roches",
        text: "Vous connaissez les sorts mineurs prestidigitation et réparation. Vous pouvez en outre consacrer 10 minutes à lancer prestidigitation pour créer un appareil mécanique de taille TP (CA 5, 1 pv) tel qu’un jouet, un allume-feu ou une boîte à musique.",
        cantrips: ["Prestidigitation", "Réparation"],
      },
    ],
    traits: [
      {
        name: "Lignage gnome",
        text: "Vous appartenez à un lignage qui vous octroie des aptitudes surnaturelles. Choisissez l’une des options ci-après ; quelle que soit celle que vous choisissez, l’Intelligence, la Sagesse ou le Charisme est votre caractéristique d’incantation pour les sorts que vous lancez avec ce trait (décidez de la caractéristique lors de la sélection du lignage) :",
      },
      {
        name: "Ruse gnome",
        text: "Vous avez l’Avantage aux jets de sauvegarde d’Intelligence, de Sagesse et de Charisme.",
      },
      DARK(18),
    ],
  },
  {
    id: "goliath",
    name: "Goliath",
    sizes: ["M"],
    sizeText: "M (moyenne, entre 2,10 m et 2,40 m)",
    speed: 10.5,
    optionLabel: "Ascendance gigante",
    options: [
      {
        id: "feu",
        name: "Brûlure ignée (géants du feu)",
        text: "Lorsque vous touchez une cible avec un jet d’attaque et lui infligez des dégâts, vous pouvez infliger 1d10 dégâts de feu supplémentaires à cette cible.",
      },
      {
        id: "pierres",
        name: "Endurance de la pierre (géants des pierres)",
        text: "Lorsque vous subissez des dégâts, vous pouvez jouer votre Réaction pour lancer 1d12. Ajoutez votre modificateur de Constitution au résultat du dé et réduisez les dégâts de la somme obtenue.",
      },
      {
        id: "givre",
        name: "Froid mordant (géants du givre)",
        text: "Lorsque vous touchez une cible avec un jet d’attaque et lui infligez des dégâts, vous pouvez infliger 1d6 dégâts de froid supplémentaires à cette cible et réduire sa vitesse de 3 m jusqu’au début de votre tour suivant.",
      },
      {
        id: "collines",
        name: "Renversement des coteaux (géants des collines)",
        text: "Lorsque vous touchez une créature de taille G ou inférieure avec un jet d’attaque et lui infligez des dégâts, vous pouvez faire subir à cette cible l’état À terre.",
      },
      {
        id: "nuees",
        name: "Saut des nuées (géants des nuages)",
        text: "Par une action Bonus, vous pouvez vous téléporter magiquement d’un maximum de 9 m dans un espace inoccupé que vous voyez.",
      },
      {
        id: "tempetes",
        name: "Tonnerre des cieux (géants des tempêtes)",
        text: "Lorsque vous subissez des dégâts de la part d’une créature dans un rayon de 18 m, vous pouvez jouer votre Réaction pour lui infliger 1d8 dégâts de tonnerre.",
      },
    ],
    traits: [
      {
        name: "Ascendance gigante",
        text: "Vous êtes un lointain descendant des géants. Choisissez l’un des bénéfices ci-après, une faveur surnaturelle liée à vos ancêtres ; vous pouvez recourir à ce bénéfice autant de fois que votre bonus de maîtrise et récupérez ce quota en terminant un Repos long :",
      },
      {
        name: "Forte carrure",
        text: "Vous avez l’Avantage à tous les tests de caractéristique que vous effectuez pour mettre un terme à l’état Agrippé. Votre catégorie de taille est en outre considérée comme du cran immédiatement supérieur pour ce qui est de définir votre capacité de charge.",
      },
    ],
  },
  {
    id: "halfelin",
    name: "Halfelin",
    sizes: ["P"],
    sizeText: "P (petite, entre 60 cm et 90 cm)",
    speed: 9,
    traits: [
      {
        name: "Agilité halfeline",
        text: "Vous pouvez vous déplacer dans l’espace de toute créature d’une catégorie de taille supérieure à la vôtre, mais ne pouvez pas vous arrêter dans le même espace que celle-ci.",
      },
      { name: "Brave", text: "Vous avez l’Avantage aux jets de sauvegarde visant à éviter l’état Effrayé ou à y mettre un terme." },
      {
        name: "Chance",
        text: "Lorsque vous obtenez un 1 au d20 d’un Test d20, vous pouvez relancer le dé, mais devez utiliser le nouveau résultat.",
      },
      {
        name: "Discrétion naturelle",
        text: "Il vous suffit d’être dans l’ombre d’une créature dont la catégorie de taille est d’au moins un cran supérieure à la vôtre pour pouvoir entreprendre l’action Furtivité.",
      },
    ],
  },
  {
    id: "humain",
    name: "Humain",
    sizes: ["M", "P"],
    sizeText: "M (moyenne, entre 1,20 m et 2,10 m) ou P (petite, de 60 cm à 1,20 m), à choisir lors de la sélection de l’espèce",
    speed: 9,
    skillChoice: { trait: "Compétent", from: null },
    originFeatChoice: true,
    traits: [
      { name: "Compétent", text: "Vous recevez la maîtrise d’une compétence de votre choix." },
      { name: "Ingénieux", text: "Vous recevez l’Inspiration héroïque chaque fois que vous terminez un Repos long." },
      { name: "Polyvalent", text: "Vous recevez le don d’origines de votre choix (cf. « Dons »). Doué est recommandé." },
    ],
  },
  {
    id: "nain",
    name: "Nain",
    sizes: ["M"],
    sizeText: "M (moyenne, entre 1,20 m et 1,50 m)",
    speed: 9,
    darkvision: 36,
    bonusHp: 1,
    traits: [
      {
        name: "Connaissance de la pierre",
        text: "Par une action Bonus, vous recevez la Perception des vibrations à 18 m pendant 10 minutes. Cette Perception des vibrations nécessite que vous soyez sur une surface en pierre ou en contact physique avec une telle surface. Cette pierre peut être naturelle ou façonnée. Vous pouvez recourir à cette action Bonus autant de fois que votre bonus de maîtrise, et récupérez ce quota en terminant un Repos long.",
      },
      {
        name: "Résistance naine",
        text: "Vous bénéficiez de la Résistance aux dégâts de poison. Vous avez en outre l’Avantage aux jets de sauvegarde visant à éviter l’état Empoisonné ou à y mettre un terme sur vous-même.",
      },
      {
        name: "Ténacité naine",
        text: "Votre maximum de points de vie augmente de 1, et augmente encore de 1 chaque fois que vous gagnez un niveau.",
      },
      DARK(36),
    ],
  },
  {
    id: "orc",
    name: "Orc",
    sizes: ["M"],
    sizeText: "M (moyenne, entre 1,80 m et 2,10 m)",
    speed: 9,
    darkvision: 36,
    traits: [
      {
        name: "Acharnement",
        text: "Si vous tombez à 0 point de vie sans être tué sur le coup, vous pouvez en fait vous retrouver à 1 point de vie. Une fois ce trait utilisé, vous devez terminer un Repos long pour pouvoir y recourir de nouveau.",
      },
      {
        name: "Poussée d’adrénaline",
        text: "Vous pouvez entreprendre l’action Pointe par une action Bonus. Quand vous faites ainsi, vous recevez un nombre de points de vie temporaires égal à votre bonus de maîtrise. Vous pouvez recourir à ce trait autant de fois que votre bonus de maîtrise, et récupérez ce quota en terminant un Repos court ou long.",
      },
      DARK(36),
    ],
  },
  {
    id: "tieffelin",
    name: "Tieffelin",
    sizes: ["M", "P"],
    sizeText: "M (moyenne, entre 1,20 m et 2,10 m) ou P (petite, de 90 cm à 1,20 m), à choisir lors de la sélection de l’espèce",
    speed: 9,
    darkvision: 18,
    optionLabel: "Héritage fiélon",
    optionSpellAbility: true,
    options: [
      {
        id: "abyssal",
        name: "Abyssal",
        text: "Vous bénéficiez de la Résistance aux dégâts de poison. Vous connaissez en outre le sort mineur bouffée de poison.",
        cantrips: ["Bouffée de poison"],
        resistance: "poison",
      },
      {
        id: "chtonien",
        name: "Chtonien",
        text: "Vous bénéficiez de la Résistance aux dégâts nécrotiques. Vous connaissez en outre le sort mineur contact glacial.",
        cantrips: ["Contact glacial"],
        resistance: "nécrotiques",
      },
      {
        id: "infernal",
        name: "Infernal",
        text: "Vous bénéficiez de la Résistance aux dégâts de feu. Vous connaissez en outre le sort mineur trait de feu.",
        cantrips: ["Trait de feu"],
        resistance: "feu",
      },
    ],
    traits: [
      {
        name: "Héritage fiélon",
        text: "Votre héritage vous octroie des aptitudes surnaturelles. Choisissez un héritage dans la table Héritages fiélons. Vous recevez le bénéfice de niveau 1 de l’héritage choisi.",
      },
      {
        name: "Présence d’outre-monde",
        text: "Vous connaissez le sort mineur thaumaturgie. Lorsque vous le lancez avec ce trait, le sort utilise la même caractéristique d’incantation que celle du trait Héritage fiélon.",
      },
      DARK(18),
    ],
  },
];

export function getSpecies(id: string): Species | undefined {
  return SPECIES.find((s) => s.id === id);
}
