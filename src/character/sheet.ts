import {
  ABILITIES,
  ABILITY_NAMES,
  PACKS,
  PROFICIENCY_BONUS,
  SKILLS,
  MASTERIES,
  FEATS,
  INVOCATIONS,
  getArmor,
  getFeat,
  formatMeters,
  getWeapon,
  modifier,
  signed,
  type Ability,
  type Armor,
  type Weapon,
} from "../srd/index.js";
import type { Draft, FeatChoice, Story } from "./draft.js";
import {
  armorTrained,
  armorTrainingOf,
  backgroundOf,
  classOf,
  finalScores,
  heldSkills,
  speciesOf,
  speciesOptionOf,
  weaponProficient,
} from "./helpers.js";
import { isComplete, nextStep } from "./steps.js";
import { PHB_TAG } from "../srd/sources.js";
import { POINT_BUDGET } from "../srd/index.js";
import { methodOf, pointsSpent, scoresPending } from "./helpers.js";

export interface SkillLine {
  name: string;
  ability: Ability;
  bonus: number;
  proficient: boolean;
  expertise: boolean;
  note?: string;
}

export interface AttackLine {
  name: string;
  attack: string;
  damage: string;
  notes: string;
}

export interface FeatureLine {
  source: string;
  name: string;
  text: string;
}

export interface SpellBlock {
  title: string;
  abilityName: string;
  dc: number;
  attackBonus: number;
  slots?: string;
  /** Nombre d'emplacements de sort de niveau 1. */
  slotCount?: number;
  cantrips: string[];
  prepared: string[];
  alwaysPrepared: string[];
  spellbook?: string[];
  extra: string[];
}

export interface Sheet {
  /**
   * Dés lancés à la table, résultats pas encore saisis : les valeurs qui dépendent des caractéristiques
   * (caractéristiques, modificateurs, sauvegardes, compétences, PV, CA, initiative, DD) ne sont pas à imprimer.
   * Les attaques et le détail des calculs donnent alors des formules.
   */
  scoresPending: boolean;
  name: string;
  className: string;
  speciesName: string;
  speciesDetail?: string;
  backgroundName: string;
  alignment: string;
  size: "M" | "P";
  speed: string;
  darkvision?: string;
  languages: string[];
  scores: Record<Ability, { score: number; mod: number }>;
  proficiencyBonus: number;
  saves: { ability: Ability; bonus: number; proficient: boolean }[];
  skills: SkillLine[];
  hp: number;
  hitDie: string;
  ac: number;
  /** Faux sur une fiche à cases vides quand la CA dépend des caractéristiques (sans armure ou armure avec Dextérité). */
  acKnown: boolean;
  acNote: string;
  initiative: number;
  passivePerception: number;
  armorTraining: string[];
  weaponProficiency: string;
  tools: string[];
  attacks: AttackLine[];
  equipment: string[];
  gold: number;
  features: FeatureLine[];
  spellBlocks: SpellBlock[];
  levelOneNotes: string[];
  /** Détail des valeurs calculées, pour comprendre d'où vient chaque nombre. */
  calculations: { label: string; value: string; detail: string }[];
  /** Sources hors SRD utilisées par cette fiche. */
  otherSources: string[];
  resistances: string[];
  warnings: string[];
  story: Story;
}

/** Arme qui peut utiliser la Dextérité à la place de la Force (Finesse, armes du Moine). */
function dexOption(d: Draft, w: Weapon): boolean {
  const isMonkWeapon = classOf(d)?.id === "moine" && w.kind === "corps à corps" && (w.category === "courante" || w.light);
  return w.finesse || isMonkWeapon;
}

function weaponAbility(d: Draft, w: Weapon, scores: Record<Ability, number>): Ability {
  if (w.kind === "distance") return "DEX";
  if (dexOption(d, w) && scores.DEX > scores.FOR) return "DEX";
  return "FOR";
}

function hasFeat(d: Draft, id: string): boolean {
  const bg = backgroundOf(d);
  return [d.speciesFeat?.featId, bg?.featId, d.fightingStyle].includes(id);
}

function featLines(d: Draft): FeatureLine[] {
  const out: FeatureLine[] = [];
  const bg = backgroundOf(d)!;
  const sources: [string, FeatChoice | undefined][] = [
    [`Don d’historique`, d.backgroundFeat ?? { featId: bg.featId }],
    [`Don d’espèce`, d.speciesFeat],
  ];
  for (const [source, f] of sources) {
    if (!f) continue;
    const feat = getFeat(f.featId);
    if (!feat) continue;
    let text = feat.summary;
    if (feat.traits.length) text = feat.traits.map((t) => `${t.name}. ${t.text}`).join(" ");
    const extras: string[] = [];
    if (f.picks) extras.push(`Maîtrises choisies : ${f.picks.join(", ")}.`);
    if (f.spellList) extras.push(`Liste de sorts : ${f.spellList}.`);
    if (f.cantrips) extras.push(`Sorts mineurs : ${f.cantrips.join(", ")}.`);
    if (f.spell) extras.push(`Sort du 1er niveau : ${f.spell}.`);
    out.push({ source, name: feat.source ? `${feat.name} (${PHB_TAG})` : feat.name, text: [text, ...extras].join(" ") });
  }
  if (d.fightingStyle) {
    const feat = FEATS.find((x) => x.id === d.fightingStyle)!;
    out.push({ source: "Style de combat", name: feat.name, text: feat.summary });
  }
  return out;
}

/**
 * Calcule la fiche complète à partir d'un brouillon terminé.
 * Chaque règle appliquée est celle du SRD 5.2.1 (voir les commentaires).
 * `pendingScores` : fiche à cases vides, quand seuls manquent les résultats des dés lancés à la table.
 */
export function computeSheet(d: Draft, opts: { pendingScores?: boolean } = {}): Sheet {
  const pending = !!opts.pendingScores && scoresPending(d);
  if (pending ? nextStep(d).kind !== "table" : !isComplete(d)) throw new Error("Le brouillon n’est pas terminé.");
  const cls = classOf(d)!;
  const sp = speciesOf(d)!;
  const spOpt = speciesOptionOf(d);
  const bg = backgroundOf(d)!;
  const warnings: string[] = [];
  if (methodOf(d) === "points" && pointsSpent(d) < POINT_BUDGET)
    warnings.push(`Acquisition par points : ${POINT_BUDGET - pointsSpent(d)} point(s) non dépensé(s) sur ${POINT_BUDGET}.`);

  // Fiche à cases vides : valeurs de 10 (modificateur nul) pour les calculs, jamais imprimées.
  const score = pending ? (Object.fromEntries(ABILITIES.map((a) => [a, 10])) as Record<Ability, number>) : finalScores(d);
  const mod = (a: Ability) => modifier(score[a]);
  const prof = PROFICIENCY_BONUS;
  /** Modificateur dans un détail de calcul : sa valeur, ou « + mod. CON » s'il reste à calculer. */
  const modTxt = (a: Ability) => (pending ? `+ mod. ${a}` : signed(mod(a)));

  // Compétences : bonus = modificateur + maîtrise (+ maîtrise de nouveau pour l'Expertise).
  const held = new Set(heldSkills(d));
  const expertise = new Set(d.expertise ?? []);
  const orderBonus = Math.max(1, mod("SAG"));
  const orderSkills: string[] = d.order === "thaumaturge" ? ["Arcanes", "Religion"] : d.order === "mage" ? ["Arcanes", "Nature"] : [];
  const skills: SkillLine[] = SKILLS.map((s) => {
    const proficient = held.has(s.name);
    const exp = expertise.has(s.name);
    let bonus = mod(s.ability) + (proficient ? prof : 0) + (exp ? prof : 0);
    let note: string | undefined;
    if (orderSkills.includes(s.name)) {
      bonus += orderBonus;
      note = pending ? "ajouter le bonus d’ordre (mod. SAG, +1 au moins)" : `inclut le bonus d’ordre (${signed(orderBonus)})`;
    }
    return { name: s.name, ability: s.ability, bonus, proficient, expertise: exp, ...(note ? { note } : {}) };
  });
  const skill = (n: string) => skills.find((s) => s.name === n)!;

  // Jets de sauvegarde : maîtrise des deux caractéristiques de la classe.
  const saves = ABILITIES.map((a) => {
    const proficient = cls.saves.includes(a);
    return { ability: a, bonus: mod(a) + (proficient ? prof : 0), proficient };
  });

  // Points de vie au niveau 1 : dé de vie maximum + modificateur de Constitution (+1 pour la Ténacité naine).
  // Robuste (Manuel 2024) : +2 par niveau de personnage, soit +2 au niveau 1.
  const hp = cls.hitDie + mod("CON") + (sp.bonusHp ?? 0) + (hasFeat(d, "robuste") ? 2 : 0);

  // Équipement.
  const eq = cls.equipment.find((e) => e.id === d.equipment)!;
  const bgA = d.backgroundEquipment === "A" && !!bg.equipmentA;
  const equipment: string[] = [];
  const weaponItems: { name: string; qty: number; note?: string }[] = [];
  let armor: Armor | undefined;
  let shield = false;
  for (const it of eq.items) {
    switch (it.kind) {
      case "weapon":
        weaponItems.push({ name: it.name, qty: it.qty ?? 1, ...(it.note ? { note: it.note } : {}) });
        equipment.push(`${it.qty && it.qty > 1 ? `${it.qty} ${it.name.toLowerCase()}s` : it.name}${it.note ? ` (${it.note})` : ""}`);
        break;
      case "armor": {
        const a = getArmor(it.name);
        if (a?.category === "bouclier") shield = true;
        else if (a) armor = a;
        equipment.push(it.name);
        break;
      }
      case "pack":
        equipment.push(`Paquetage d’${it.pack} : ${(PACKS[it.pack] ?? []).join(", ").toLowerCase()}`);
        break;
      case "item":
        equipment.push(it.qty ? `${it.qty} ${it.name.toLowerCase()}` : it.name);
        break;
      case "choice":
        equipment.push(it.what === "instrument" ? (d.instrument ?? "Instrument de musique") : (d.classTools?.[0] ?? "Outil"));
        break;
    }
  }
  if (bgA) {
    for (const w of bg.weaponsA) weaponItems.push({ name: w.name, qty: w.qty ?? 1 });
    for (const item of bg.equipmentA ?? []) {
      equipment.push(item.startsWith("Boîte de jeux") ? `Boîte de jeux : ${d.gamingSet ?? ""}` : item);
    }
  }
  const gold = eq.gold + (bgA ? bg.goldA : bg.goldB);
  const mergedWeapons = new Map<string, { name: string; qty: number }>();
  for (const it of weaponItems) {
    const prev = mergedWeapons.get(it.name);
    mergedWeapons.set(it.name, { name: it.name, qty: (prev?.qty ?? 0) + it.qty });
  }
  // Une même arme obtenue deux fois (classe et historique) apparaît une seule fois dans l'équipement.
  for (const w of mergedWeapons.values()) {
    if (weaponItems.filter((x) => x.name === w.name).length < 2) continue;
    const esc = (t: string) => t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^(\\d+ )?(${esc(w.name)}|${esc(pluralFr(w.name))})( \\((.*)\\))?$`, "i");
    const notes = equipment.map((l) => re.exec(l)?.[4]).filter((n): n is string => !!n);
    const first = equipment.findIndex((l) => re.test(l));
    if (first < 0) continue;
    const merged = `${w.qty} ${pluralFr(w.name).toLowerCase()}${notes.length ? ` (${notes.join(", ")})` : ""}`;
    const kept = equipment.map((l, idx) => (idx === first ? merged : l)).filter((l, idx) => idx === first || !re.test(l));
    equipment.length = 0;
    equipment.push(...kept);
  }

  // Classe d'armure.
  const dex = mod("DEX");
  const options: { ac: number; note: string; detail: string; fixed?: boolean }[] = [];
  // Sans formation aux boucliers, le bouclier ne donne pas son bonus (SRD).
  const shieldBonus = shield && armorTrainingOf(d).includes("bouclier") ? 2 : 0;
  const shieldTxt = shieldBonus ? " +2 (bouclier)" : "";
  if (armor) {
    const a = armor;
    const dexPart = a.addDex ? (a.dexMax !== null ? Math.min(dex, a.dexMax) : dex) : 0;
    const defense = d.fightingStyle === "defense" ? 1 : 0;
    options.push({
      ac: a.baseAc + dexPart + shieldBonus + defense,
      fixed: !a.addDex,
      note: `${a.name}${shield ? " + bouclier" : ""}${defense ? ", style Défense +1" : ""}`,
      detail: `${a.baseAc} (${a.name})${a.addDex ? ` ${pending ? "+ mod. DEX" : signed(dexPart)} (Dextérité${a.dexMax !== null ? `, ${a.dexMax} au plus` : ""})` : ""}${shieldTxt}${defense ? " +1 (style Défense)" : ""}`,
    });
    if (!armorTrained(d, a)) warnings.push(`Tu n’es pas formé à ${a.name} : Désavantage aux Tests d20 de Force ou de Dextérité et pas de sorts.`);
    if (a.minStrength && pending) warnings.push(`${a.name} demande Force ${a.minStrength} : en dessous, ta Vitesse est réduite de 3 m.`);
    else if (a.minStrength && score.FOR < a.minStrength)
      warnings.push(`${a.name} demande Force ${a.minStrength} : ta Vitesse est réduite de 3 m.`);
  } else {
    options.push({ ac: 10 + dex + shieldBonus, note: shield ? "sans armure, avec bouclier" : "sans armure", detail: `10 ${modTxt("DEX")} (Dextérité)${shieldTxt}` });
    if (cls.id === "barbare")
      options.push({
        ac: 10 + dex + mod("CON") + shieldBonus,
        note: "Défense sans armure (Dex + Con)",
        detail: `10 ${modTxt("DEX")} (Dextérité) ${modTxt("CON")} (Constitution)${shieldTxt}, Défense sans armure`,
      });
    if (cls.id === "moine" && !shield)
      options.push({ ac: 10 + dex + mod("SAG"), note: "Défense sans armure (Dex + Sag)", detail: `10 ${modTxt("DEX")} (Dextérité) ${modTxt("SAG")} (Sagesse), Défense sans armure` });
  }
  if (shield && !armorTrainingOf(d).includes("bouclier")) warnings.push("Tu n’es pas formé aux boucliers : ils ne donnent pas de bonus de CA.");
  // À valeurs inconnues, la meilleure option n'est pas connue : la fiche à cases vides les donne toutes.
  const acKnown = !pending || (options.length === 1 && !!options[0]!.fixed);
  const best = !acKnown
    ? { ac: 0, note: options.map((o) => o.note).join(" ou "), detail: options.length > 1 ? `la plus haute de : ${options.map((o) => o.detail).join(" ; ")}` : options[0]!.detail }
    : options.reduce((x, y) => (y.ac > x.ac ? y : x));

  // Attaques.
  const attacks: AttackLine[] = [];
  const masteries = new Set(d.masteries ?? []);
  for (const item of mergedWeapons.values()) {
    const w = getWeapon(item.name);
    if (!w) continue;
    const ab = weaponAbility(d, w, score);
    const proficient = weaponProficient(d, w);
    const archery = d.fightingStyle === "archerie" && w.kind === "distance" ? 2 : 0;
    const atk = mod(ab) + (proficient ? prof : 0) + archery;
    const dmgMod = mod(ab);
    // Fiche à cases vides : « FOR +2 » et « 1d8 + FOR » (FOR ou DEX, la plus haute, pour Finesse).
    const abTxt = w.kind === "distance" ? "DEX" : dexOption(d, w) ? "FOR ou DEX" : "FOR";
    const fixed = (proficient ? prof : 0) + archery;
    const dmg = pending ? `${w.damage} + ${abTxt} ${w.damageType}` : `${w.damage}${dmgMod ? signed(dmgMod) : ""} ${w.damageType}`;
    const notes: string[] = [];
    if (w.properties && w.properties !== "—") notes.push(w.properties);
    if (w.versatile) notes.push(`à deux mains : ${w.versatile}`);
    notes.push(masteries.has(w.name) ? `Botte ${w.mastery} (maîtrisée)` : `Botte ${w.mastery} (non maîtrisée)`);
    if (!proficient) notes.push("sans maîtrise");
    if (cls.id === "moine" && w.kind === "corps à corps" && (w.category === "courante" || w.light))
      notes.push("dé d’Arts martiaux 1d6 possible");
    attacks.push({
      name: `${w.name}${item.qty > 1 ? ` ×${item.qty}` : ""}`,
      attack: pending ? `${abTxt}${fixed ? ` ${signed(fixed)}` : ""}` : signed(atk),
      damage: dmg,
      notes: notes.join(" ; "),
    });
  }
  // Attaque à mains nues (SRD : Force + maîtrise, 1 + modificateur de Force).
  if (cls.id === "moine") {
    const ab: Ability = score.DEX > score.FOR ? "DEX" : "FOR";
    attacks.push({
      name: "Attaque à mains nues",
      attack: pending ? `FOR ou DEX ${signed(prof)}` : signed(mod(ab) + prof),
      damage: pending ? "1d6 + FOR ou DEX contondants" : `1d6${mod(ab) ? signed(mod(ab)) : ""} contondants`,
      notes: "Arts martiaux : une attaque à mains nues supplémentaire par action Bonus",
    });
  } else if (hasFeat(d, "bagarreur")) {
    attacks.push({
      name: "Attaque à mains nues",
      attack: pending ? `FOR ${signed(prof)}` : signed(mod("FOR") + prof),
      damage: pending ? "1d4 + FOR contondants" : `1d4${mod("FOR") ? signed(mod("FOR")) : ""} contondants`,
      notes: "Bagarreur de taverne : relance des 1, bousculade de 1,50 m une fois par tour",
    });
  } else {
    attacks.push({
      name: "Attaque à mains nues",
      attack: pending ? `FOR ${signed(prof)}` : signed(mod("FOR") + prof),
      damage: pending ? "1 + FOR contondants" : `${1 + mod("FOR")} contondants`,
      notes: "",
    });
  }

  // Maîtrises d'outils.
  const tools = new Set<string>();
  tools.add(
    bg.toolChoice === "gaming-set"
      ? `Boîte de jeux : ${d.gamingSet}`
      : bg.toolChoice === "fixed"
        ? bg.tool
        : (d.backgroundTool ?? bg.tool),
  );
  for (const t of cls.tools.fixed) tools.add(t);
  for (const t of d.classTools ?? []) tools.add(t);
  for (const f of [d.speciesFeat, d.backgroundFeat])
    if (f?.picks) for (const p of f.picks) if (!SKILLS.some((s) => s.name === p)) tools.add(p);

  // Maîtrise des armes (texte).
  const w = cls.weaponProficiency;
  const wp: string[] = [];
  if (w.simple) wp.push("armes courantes");
  if (w.martial === "all" || d.order === "protecteur" || d.order === "gardien") wp.push("armes de guerre");
  else if (w.martial === "light") wp.push("armes de guerre de corps à corps dotées de la propriété Légère");
  else if (w.martial === "finesse-or-light") wp.push("armes de guerre dotées de la propriété Finesse ou Légère");

  // Langues.
  const languages = ["Commun", ...(d.languages ?? [])];
  if (cls.id === "druide") languages.push("Druidique");
  if (cls.id === "roublard") languages.push("Argot des voleurs", ...(d.extraLanguage ? [d.extraLanguage] : []));

  // Traits.
  const features: FeatureLine[] = [];
  for (const t of sp.traits) {
    features.push({ source: `Espèce : ${sp.name}`, name: t.name, text: t.text });
  }
  if (spOpt) features.push({ source: `Espèce : ${sp.name}`, name: `${sp.optionLabel ?? "Option"} : ${spOpt.name}`, text: spOpt.text });
  for (const t of cls.traits) features.push({ source: `Classe : ${cls.name}`, name: t.name, text: t.text });
  if (d.order) {
    // le texte de l'ordre est celui de la classe ; rappel du choix
    features.push({
      source: `Classe : ${cls.name}`,
      name: `Choix : ${d.order.charAt(0).toUpperCase()}${d.order.slice(1)}`,
      text: "Rôle choisi parmi ceux de l’aptitude ci-dessus.",
    });
  }
  if (d.invocation) {
    features.push({
      source: `Classe : ${cls.name}`,
      name: `Manifestation occulte : ${d.invocation}`,
      text: INVOCATIONS[d.invocation] ?? "",
    });
  }
  features.push(...featLines(d));

  // Sorts.
  const spellBlocks: SpellBlock[] = [];
  const casting = cls.spellcasting;
  if (casting) {
    const m = mod(casting.ability);
    const cantrips = [...(d.cantrips ?? []), ...(d.pactCantrips ?? [])];
    const extra = [casting.abilityText, casting.focusText];
    if (d.invocation === "Pacte du grimoire" && d.pactRituals) extra.push(`Rituels du Pacte du grimoire : ${d.pactRituals.join(", ")}.`);
    spellBlocks.push({
      title: `Sorts de ${cls.name}`,
      abilityName: ABILITY_NAMES[casting.ability],
      dc: 8 + m + prof,
      attackBonus: m + prof,
      slots: casting.pact ? "1 emplacement de niveau 1 (récupéré après un repos court ou long)" : `${casting.slots} emplacements de niveau 1`,
      slotCount: casting.pact ? 1 : casting.slots,
      cantrips,
      prepared: d.prepared ?? [],
      alwaysPrepared: casting.alwaysPrepared ?? [],
      ...(d.spellbook ? { spellbook: d.spellbook } : {}),
      extra,
    });
  }
  if (spOpt && d.speciesAbility && (sp.optionSpellAbility ?? false)) {
    const m = mod(d.speciesAbility);
    spellBlocks.push({
      title: `Sorts d’espèce (${sp.name})`,
      abilityName: ABILITY_NAMES[d.speciesAbility],
      dc: 8 + m + prof,
      attackBonus: m + prof,
      cantrips: [...(spOpt.cantrips ?? []), ...(sp.id === "tieffelin" ? ["Thaumaturgie"] : [])],
      prepared: [],
      alwaysPrepared: spOpt.alwaysPrepared ?? [],
      extra: [],
    });
  }
  if (sp.innateCantrip) {
    const m = mod(sp.innateCantrip.ability);
    spellBlocks.push({
      title: `Sorts d’espèce (${sp.name})`,
      abilityName: ABILITY_NAMES[sp.innateCantrip.ability],
      dc: 8 + m + prof,
      attackBonus: m + prof,
      cantrips: [sp.innateCantrip.name],
      prepared: [],
      alwaysPrepared: [],
      extra: [],
    });
  }
  for (const f of [d.backgroundFeat, d.speciesFeat]) {
    if (f?.featId === "initie-magie" && f.ability) {
      const m = mod(f.ability);
      spellBlocks.push({
        title: "Initié à la magie",
        abilityName: ABILITY_NAMES[f.ability],
        dc: 8 + m + prof,
        attackBonus: m + prof,
        cantrips: f.cantrips ?? [],
        prepared: [],
        alwaysPrepared: f.spell ? [f.spell] : [],
        extra: ["Le sort du 1er niveau peut être lancé une fois sans emplacement par Repos long."],
      });
    }
  }
  // Fix : le bg feat n'est pas forcément dans le brouillon (valeur par défaut).
  if (bg.featId === "initie-magie" && !d.backgroundFeat) warnings.push("Don d’historique incomplet.");

  const resistances: string[] = [];
  if (spOpt?.resistance) resistances.push(spOpt.resistance);
  if (sp.id === "nain") resistances.push("poison");
  resistances.push(...(sp.resistances ?? []));

  const initiative = dex + (hasFeat(d, "vigilant") ? prof : 0);
  const darkvision = spOpt?.darkvision ?? sp.darkvision;
  const speed = spOpt?.speed ?? sp.speed;
  const per = skill("Perception");
  const todo = "à calculer";
  const calculations: Sheet["calculations"] = [
    { label: "Bonus de maîtrise", value: signed(prof), detail: "personnage de niveau 1" },
    ...(pending
      ? [
          { label: "Modificateur de caractéristique", value: todo, detail: "(valeur - 10) / 2, arrondi à l’entier inférieur : 3 = -4, 4-5 = -3, 6-7 = -2, 8-9 = -1, 10-11 = +0, 12-13 = +1, 14-15 = +2, 16-17 = +3, 18-19 = +4, 20 = +5" },
          { label: "Jets de sauvegarde", value: todo, detail: `modificateur, ${signed(prof)} pour les deux maîtrisées (${cls.saves.join(" et ")})` },
          { label: "Compétences", value: todo, detail: `modificateur de la caractéristique, ${signed(prof)} si la case est cochée, ${signed(prof)} de plus pour l’expertise` },
        ]
      : []),
    {
      label: "Points de vie maximum",
      value: pending ? todo : String(hp),
      detail: [
        `${cls.hitDie} (valeur maximale du dé de vie d${cls.hitDie})`,
        `${modTxt("CON")} (modificateur de Constitution)`,
        ...(sp.bonusHp ? [`+${sp.bonusHp} (${sp.name} : Ténacité naine)`] : []),
        ...(hasFeat(d, "robuste") ? ["+2 (Robuste)"] : []),
      ].join(" "),
    },
    { label: "Classe d’armure", value: acKnown ? String(best.ac) : todo, detail: best.detail },
    {
      label: "Initiative",
      value: pending ? todo : signed(initiative),
      detail: `${pending ? "mod. DEX" : signed(dex)} (modificateur de Dextérité)${hasFeat(d, "vigilant") ? ` ${signed(prof)} (Vigilant : bonus de maîtrise)` : ""}`,
    },
    {
      label: "Perception passive",
      value: pending ? todo : String(10 + per.bonus),
      detail: pending ? `10 + bonus de Perception (mod. SAG${per.proficient ? ` ${signed(prof)}, compétence maîtrisée` : ""}${per.expertise ? ` ${signed(prof)}, expertise` : ""})` : `10 ${signed(per.bonus)} (bonus de Perception)`,
    },
    ...spellBlocks.map((b) => {
      const ab = ABILITIES.find((a) => ABILITY_NAMES[a] === b.abilityName) ?? "INT";
      return pending
        ? { label: `${b.title} : DD et attaque`, value: todo, detail: `DD = 8 ${signed(prof)} (maîtrise) + mod. ${ab} ; attaque = ${signed(prof)} (maîtrise) + mod. ${ab}` }
        : {
            label: `${b.title} : DD et attaque`,
            value: `DD ${b.dc}, ${signed(b.attackBonus)}`,
            detail: `DD = 8 ${signed(prof)} (maîtrise) ${signed(b.dc - 8 - prof)} (${b.abilityName}) ; attaque = ${signed(prof)} (maîtrise) ${signed(b.attackBonus - prof)} (${b.abilityName})`,
          };
    }),
  ];

  return {
    scoresPending: pending,
    name: d.name!,
    className: cls.name,
    speciesName: sp.source ? `${sp.name} (${PHB_TAG})` : sp.name,
    ...(spOpt ? { speciesDetail: spOpt.name } : {}),
    backgroundName: bg.source ? `${bg.name} (${PHB_TAG})` : bg.name,
    alignment: d.alignment!,
    size: sp.sizes.length > 1 ? d.size! : sp.sizes[0]!,
    speed: formatMeters(speed),
    ...(darkvision ? { darkvision: formatMeters(darkvision) } : {}),
    languages,
    scores: Object.fromEntries(ABILITIES.map((a) => [a, { score: score[a], mod: mod(a) }])) as Sheet["scores"],
    proficiencyBonus: prof,
    saves,
    skills,
    hp,
    hitDie: `1d${cls.hitDie}`,
    ac: best.ac,
    acKnown,
    acNote: best.note,
    initiative,
    passivePerception: 10 + per.bonus,
    armorTraining: armorTrainingOf(d),
    weaponProficiency: [wp.join(" et "), ...(hasFeat(d, "bagarreur") ? ["armes improvisées"] : [])].join(", "),
    tools: [...tools],
    attacks,
    equipment,
    gold,
    features,
    spellBlocks,
    levelOneNotes: [
      ...cls.levelOneNotes,
      ...(bg.equipmentA ? [] : [`Équipement d’historique : l’option A de ${bg.name} n’est donnée par aucune source fournie, la fiche applique l’option B (${bg.goldB} po).`]),
    ],
    calculations,
    otherSources: [
      ...new Set(
        [sp.source, bg.source, bg.source ? bg.equipmentSource : undefined, ...[d.backgroundFeat?.featId ?? bg.featId, d.speciesFeat?.featId].map((id) => (id ? getFeat(id)?.source : undefined))].filter(
          (x): x is string => !!x,
        ),
      ),
    ],
    resistances,
    warnings,
    story: d.story ?? {},
  };
}

export { MASTERIES };

/** Pluriel simple d'un nom d'objet : premier mot au pluriel (« bâton de combat » → « bâtons de combat »). */
export function pluralFr(name: string): string {
  const [head, ...rest] = name.split(" ");
  const p = /[sxz]$/i.test(head!) ? head! : /au$|eu$/i.test(head!) ? `${head}x` : `${head}s`;
  return [p, ...rest].join(" ");
}
