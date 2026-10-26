import {
  ABILITIES,
  ABILITY_NAMES,
  ARTISAN_TOOLS,
  BACKGROUNDS,
  CLASSES,
  COMMON_LANGUAGES,
  FEATS,
  FIGHTING_STYLE_FEATS,
  GAMING_SETS,
  INVOCATIONS,
  MUSICAL_INSTRUMENTS,
  ORIGIN_FEATS,
  RARE_LANGUAGES,
  SKILL_NAMES,
  SPECIES,
  WEAPONS,
  allSpells,
  formatMeters,
  rollAbilityScores,
  spellsFor,
  type Ability,
  type Background,
  type ClassData,
  type Spell,
  type SpellListId,
} from "../srd/index.js";
import type { Draft, FeatChoice } from "./draft.js";
import { PHB_TAG } from "../srd/sources.js";
import { guideClass } from "../guide/index.js";
import { spellTagLine } from "./spell-tags.js";
import { POINT_BUDGET, POINT_COST, STANDARD_BY_CLASS } from "../srd/index.js";
import { METHOD_NAMES, describeRules, type Method } from "./rules.js";
import {
  armorTrainingOf,
  backgroundOf,
  classCantripCount,
  classOf,
  finalScores,
  heldSkills,
  heldTools,
  methodOf,
  pointsSpent,
  valuesOf,
  knownCantrips,
  speciesOf,
  speciesOptionOf,
  weaponProficient,
} from "./helpers.js";

export interface Option {
  value: string;
  label: string;
  description?: string;
}

export type Step =
  | { kind: "name"; id: "name"; title: string }
  | { kind: "select"; id: string; title: string; help?: string; options: Option[] }
  | { kind: "multi"; id: string; title: string; help?: string; options: Option[]; min: number; max: number }
  | { kind: "roll"; id: "roll"; title: string; help: string }
  | { kind: "table"; id: "tableRolls"; title: string; help: string }
  | { kind: "confirm"; id: string; title: string; help: string; button: string }
  | { kind: "story"; id: "story"; title: string; help: string }
  | { kind: "done"; id: "done" };

export const ALIGNMENTS = [
  "Loyal bon",
  "Neutre bon",
  "Chaotique bon",
  "Loyal neutre",
  "Neutre",
  "Chaotique neutre",
  "Loyal mauvais",
  "Neutre mauvais",
  "Chaotique mauvais",
  "Non aligné",
];

/** Option d'étape. Description complète : l'interface Discord la coupe elle-même à sa limite (100 caractères). */
const opt = (value: string, label = value, description?: string): Option => ({
  value,
  label,
  ...(description ? { description } : {}),
});

const abilityOptions = (list: readonly Ability[]): Option[] => list.map((a) => opt(a, `${ABILITY_NAMES[a]} (${a})`));

function spellOption(s: Spell): Option {
  const tags = spellTagLine(s.name);
  const flags = [s.school, s.concentration ? "Concentration" : null, s.ritual ? "Rituel" : null, s.costlyMaterial ? "Composante coûteuse" : null]
    .filter(Boolean)
    .join(" · ");
  return opt(s.name, s.name, `${tags || flags}${s.costlyMaterial ? " · composante coûteuse" : ""}`);
}

/** Sorts de niveau `level` de la liste, hors sorts exclus (déjà connus ou toujours préparés). */
function spellOptions(list: SpellListId, level: number, exclude: string[] = []): Option[] {
  return spellsFor(list, level)
    .filter((s) => !exclude.includes(s.name))
    .map(spellOption);
}

function featStep(prefix: "speciesFeat" | "backgroundFeat", f: FeatChoice, d: Draft, title: string): Step | null {
  const held = heldSkills(d);
  const def = FEATS.find((x) => x.id === f.featId);
  if (def?.choice && (!f.picks || f.picks.length !== def.choice.count)) {
    const own = new Set(f.picks ?? []);
    const pool = (def.choice.from === "artisan" ? ARTISAN_TOOLS : MUSICAL_INSTRUMENTS).filter((t) => own.has(t) || !heldTools(d).includes(t));
    return {
      kind: "multi",
      id: `${prefix}.picks`,
      title: `${title} : ${def.name}`,
      help: `Choisis ${def.choice.count} ${def.choice.from === "artisan" ? "outils d’artisan" : "instruments de musique"} différents.`,
      options: pool.map((t) => opt(t)),
      min: def.choice.count,
      max: def.choice.count,
    };
  }
  if (f.featId === "doue") {
    if (!f.picks || f.picks.length !== 3) {
      const skills = SKILL_NAMES.filter((s) => !held.includes(s));
      const tools = [...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS, ...GAMING_SETS].filter((t) => !heldTools(d).includes(t));
      return {
        kind: "multi",
        id: `${prefix}.picks`,
        title: `${title} : Doué`,
        help: "Choisis trois maîtrises parmi les compétences et les outils.",
        options: [...skills.map((s) => opt(s, s, "Compétence")), ...tools.map((t) => opt(t, t, "Outil"))],
        min: 3,
        max: 3,
      };
    }
  }
  if (f.featId === "initie-magie") {
    if (!f.spellList) {
      return {
        kind: "select",
        id: `${prefix}.list`,
        title: `${title} : Initié à la magie`,
        help: "Choisis la liste de sorts de ce don.",
        options: [opt("clerc", "Clerc"), opt("druide", "Druide"), opt("magicien", "Magicien")],
      };
    }
    if (!f.ability) {
      return {
        kind: "select",
        id: `${prefix}.ability`,
        title: `${title} : caractéristique d’incantation`,
        help: "Intelligence, Sagesse ou Charisme pour les sorts de ce don.",
        options: abilityOptions(["INT", "SAG", "CHA"]),
      };
    }
    if (!f.cantrips || f.cantrips.length !== 2) {
      return {
        kind: "multi",
        id: `${prefix}.cantrips`,
        title: `${title} : deux sorts mineurs`,
        help: `Liste du ${f.spellList}. Les sorts mineurs déjà connus ne sont pas proposés.`,
        options: spellOptions(f.spellList, 0, knownCantrips(d)),
        min: 2,
        max: 2,
      };
    }
    if (!f.spell) {
      return {
        kind: "select",
        id: `${prefix}.spell`,
        title: `${title} : un sort du 1er niveau`,
        help: `Liste du ${f.spellList}.`,
        options: spellOptions(f.spellList, 1),
      };
    }
  }
  return null;
}

function weaponMasteryOptions(d: Draft): Option[] {
  const cls = classOf(d);
  const rule = cls?.weaponMastery;
  if (!rule) return [];
  return WEAPONS.filter((w) => {
    if (rule.from === "melee") return w.kind === "corps à corps";
    if (rule.from === "proficient") return weaponProficient(d, w);
    return true;
  }).map((w) => opt(w.name, w.name, `${w.damage} ${w.damageType} · Botte : ${w.mastery}`));
}

function equipmentSummary(cls: NonNullable<ReturnType<typeof classOf>>, id: "A" | "B" | "C"): string {
  const o = cls.equipment.find((e) => e.id === id)!;
  const names = o.items.map((it) => {
    switch (it.kind) {
      case "weapon":
        return it.qty ? `${it.qty} ${it.name.toLowerCase()}` : it.name;
      case "armor":
        return it.name;
      case "pack":
        return `paquetage d’${it.pack}`;
      case "item":
        return it.qty ? `${it.qty} ${it.name.toLowerCase()}` : it.name;
      case "choice":
        return it.what === "instrument" ? "un instrument au choix" : "outils ou instrument";
    }
  });
  return `${names.join(", ")}${names.length ? " et " : ""}${o.gold} po`;
}

/** Étapes des caractéristiques : méthode, tirage, répartition et bonus d'historique. */
function scoreStep(d: Draft, cls: ClassData, bg: Background, method: Method | undefined): Step | null {
  if (!method)
    return {
      kind: "select",
      id: "method",
      title: "Méthode de génération des caractéristiques",
      help: `Méthodes autorisées par le MJ pour cette campagne.${
        d.rules!.methods.includes("table") ? " Avec les dés lancés à la table, tu fais tout le reste maintenant et tu saisis tes six résultats à la fin, après le tirage." : ""
      }`,
      options: d.rules!.methods.map((m) => opt(m, METHOD_NAMES[m])),
    };
  if (method === "table" && !d.rolls) return null;
  if (method === "des" && !d.rolls)
    return {
      kind: "roll",
      id: "roll",
      title: "Tirage des caractéristiques",
      help: "Six tirages de 4d6, on garde les trois meilleurs dés. Le tirage est définitif.",
    };
  const suggestion = STANDARD_BY_CLASS[cls.id];
  if (d.rules && !d.assignMode && suggestion)
    return {
      kind: "select",
      id: "assignMode",
      title: "Répartition des valeurs",
      help: `Le SRD propose une répartition par classe (table « Valeurs standard par classe ») : ${ABILITIES.map((a) => `${a} ${suggestion[a]}`).join(", ")}. ${
        method === "des" || method === "table" ? "Avec les dés, la suggestion place ton meilleur résultat là où la table met sa plus haute valeur, et ainsi de suite." : ""
      } Tu peux la modifier ensuite avec Retour ou Modifier une étape.`,
      options: [opt("suggested", "Répartition suggérée", `Pour ${cls.name}`), opt("manual", "Je répartis moi-même")],
    };
  if (method === "points") {
    for (const a of ABILITIES) {
      if (d.points?.[a] === undefined) {
        const left = POINT_BUDGET - pointsSpent(d);
        return {
          kind: "select",
          id: `pb.${a}`,
          title: `Achat par points : ${ABILITY_NAMES[a]} (${a})`,
          help: `Points restants : ${left} sur ${POINT_BUDGET}. Coûts : 8 = 0, 9 = 1, 10 = 2, 11 = 3, 12 = 4, 13 = 5, 14 = 7, 15 = 9.`,
          options: Object.entries(POINT_COST)
            .filter(([, c]) => c <= left)
            .map(([v, c]) => opt(v, v, `coût ${c} point${c > 1 ? "s" : ""}`)),
        };
      }
    }
  } else {
    const values = valuesOf(d)!;
    const assigned = d.assignment ?? {};
    for (const a of ABILITIES) {
      if (assigned[a] === undefined) {
        const used = new Set(Object.values(assigned));
        return {
          kind: "select",
          id: `assign.${a}`,
          title: `Assigne une valeur à ${ABILITY_NAMES[a]} (${a})`,
          help: `${method === "standard" ? "Valeurs standard" : "Résultats du tirage"} : ${values.join(", ")}.`,
          options: values.map((v, i) => ({ v, i })).filter((x) => !used.has(x.i)).map((x) => opt(String(x.i), String(x.v))),
        };
      }
    }
  }
  if (!d.bonusMode)
    return {
      kind: "select",
      id: "bonusMode",
      title: `Bonus d’historique (${bg.abilities.join(", ")})`,
      help: "Un +2 et un +1, ou +1 aux trois caractéristiques. Aucune valeur ne dépasse 20.",
      options: [opt("2-1", "+2 et +1"), opt("1-1-1", "+1, +1 et +1")],
    };
  if (d.bonusMode === "2-1") {
    if (!d.bonusPlus2)
      return { kind: "select", id: "bonusPlus2", title: "Quelle caractéristique reçoit +2 ?", options: abilityOptions(bg.abilities) };
    if (!d.bonusPlus1)
      return {
        kind: "select",
        id: "bonusPlus1",
        title: "Quelle caractéristique reçoit +1 ?",
        options: abilityOptions(bg.abilities.filter((a) => a !== d.bonusPlus2)),
      };
  }
  return null;
}

export function nextStep(d: Draft): Step {
  // 1. Nom
  if (!d.name) return { kind: "name", id: "name", title: "Comment s’appelle ton personnage ?" };

  // 2. Classe
  if (d.rules && !d.rulesAck)
    return {
      kind: "confirm",
      id: "rules",
      title: "Paramètres de création de la campagne",
      help: `${describeRules(d.rules)}\n\nCes paramètres sont fixés par le MJ.`,
      button: "Commencer",
    };

  if (!d.classId)
    return {
      kind: "select",
      id: "class",
      title: "Choisis ta classe",
      help: "Personnage de niveau 1.",
      options: CLASSES.map((c) => opt(c.id, c.name, `d${c.hitDie} · ${guideClass(c.id)?.role ?? ""}`)),
    };
  const cls = classOf(d)!;

  // 3. Espèce
  if (!d.speciesId)
    return {
      kind: "select",
      id: "species",
      title: "Choisis ton espèce",
      help: "Les espèces marquées « Manuel 2024 » viennent hors SRD (source citée sur la fiche).",
      options: SPECIES.filter((s) => d.rules?.content !== "srd" || !s.source).map((s) => opt(s.id, s.name, `${s.source ? `${PHB_TAG} · ` : ""}Vitesse ${formatMeters(s.speed)}`)),
    };
  const sp = speciesOf(d)!;
  if (sp.options && !d.speciesOption)
    return {
      kind: "select",
      id: "speciesOption",
      title: `${sp.name} : ${sp.optionLabel?.toLowerCase() ?? "option"}`,
      options: sp.options.map((o) => opt(o.id, o.name, o.text)),
    };
  if (sp.optionSpellAbility && !d.speciesAbility)
    return {
      kind: "select",
      id: "speciesAbility",
      title: `${sp.name} : caractéristique d’incantation`,
      help: "Intelligence, Sagesse ou Charisme pour les sorts de ce trait.",
      options: abilityOptions(["INT", "SAG", "CHA"]),
    };
  if (sp.sizes.length > 1 && !d.size)
    return {
      kind: "select",
      id: "size",
      title: `${sp.name} : taille`,
      options: sp.sizes.map((s) => opt(s, s === "M" ? "Moyenne (M)" : "Petite (P)")),
    };

  // 4. Historique
  if (!d.backgroundId)
    return {
      kind: "select",
      id: "background",
      title: "Choisis ton historique",
      help: "Les historiques marqués « Manuel 2024 » viennent du référentiel du MJ (hors SRD).",
      options: BACKGROUNDS.filter((b) => d.rules?.content !== "srd" || !b.source).map((b) =>
        opt(b.id, b.name, `${b.source ? `${PHB_TAG} · ` : ""}${b.abilities.join(", ")} · ${b.skills.join(" et ")}`),
      ),
    };
  const bg = backgroundOf(d)!;

  // 5. Choix d'espèce dépendant de l'historique
  if (sp.skillChoice && !d.speciesSkill) {
    const from = (sp.skillChoice.from ?? SKILL_NAMES).filter((s) => !bg.skills.includes(s));
    return {
      kind: "select",
      id: "speciesSkill",
      title: `${sp.name} : ${sp.skillChoice.trait}`,
      help: "Les compétences que ton historique accorde déjà ne sont pas proposées.",
      options: from.map((s) => opt(s)),
    };
  }
  if (sp.originFeatChoice) {
    if (!d.speciesFeat)
      return {
        kind: "select",
        id: "speciesFeat",
        title: `${sp.name} : don d’origine (Polyvalent)`,
        help: "Doué est recommandé.",
        options: ORIGIN_FEATS.filter((f) => d.rules?.content !== "srd" || !f.source).map((f) =>
          opt(f.id, f.name, `${f.source ? `${PHB_TAG} · ` : ""}${f.summary}`),
        ),
      };
    // Doué est traité après les compétences de classe : ses choix ne doivent pas vider la liste de la classe.
    if (d.speciesFeat.featId !== "doue") {
      const s = featStep("speciesFeat", d.speciesFeat, d, "Don d’espèce");
      if (s) return s;
    }
  }

  // 6. Don d'historique
  const bgFeat: FeatChoice = d.backgroundFeat ?? { featId: bg.featId, ...(bg.featSpellList ? { spellList: bg.featSpellList } : {}) };
  const bs = featStep("backgroundFeat", bgFeat, d, "Don d’historique");
  if (bs) return bs;
  if ((bg.toolChoice === "artisan" || bg.toolChoice === "instrument") && !d.backgroundTool)
    return {
      kind: "select",
      id: "backgroundTool",
      title: `${bg.name} : ${bg.toolChoice === "artisan" ? "outil d’artisan" : "instrument de musique"} maîtrisé`,
      options: (bg.toolChoice === "artisan" ? ARTISAN_TOOLS : MUSICAL_INSTRUMENTS).filter((t) => !heldTools(d).includes(t)).map((t) => opt(t)),
    };
  if (bg.toolChoice === "gaming-set" && !d.gamingSet)
    return {
      kind: "select",
      id: "gamingSet",
      title: `${bg.name} : boîte de jeux`,
      options: GAMING_SETS.map((g) => opt(g)),
    };

  // 7. Caractéristiques. Dés lancés à la table : la saisie et la répartition viennent à la fin du parcours.
  const method = methodOf(d);
  const scores = scoreStep(d, cls, bg, method);
  if (scores) return scores;

  // 8. Choix de classe
  if (cls.order && !d.order) {
    if (cls.order === "divin")
      return {
        kind: "select",
        id: "order",
        title: "Ordre divin",
        options: [
          opt("protecteur", "Protecteur", "Armes de guerre et armures lourdes"),
          opt("thaumaturge", "Thaumaturge", "Un sort mineur de plus et un bonus en Arcanes et Religion"),
        ],
      };
    return {
      kind: "select",
      id: "order",
      title: "Ordre primitif",
      options: [
        opt("mage", "Mage", "Un sort mineur de plus et un bonus en Arcanes et Nature"),
        opt("gardien", "Gardien", "Armes de guerre et armures intermédiaires"),
      ],
    };
  }
  if (cls.fightingStyle && !d.fightingStyle)
    return {
      kind: "select",
      id: "fightingStyle",
      title: "Style de combat",
      help: "Défense est recommandé.",
      options: FIGHTING_STYLE_FEATS.map((f) => opt(f.id, f.name, f.summary)),
    };
  if (!d.classSkills) {
    const from = (cls.skills.from ?? SKILL_NAMES).filter((s) => !heldSkills(d).includes(s));
    return {
      kind: "multi",
      id: "classSkills",
      title: `Compétences de ${cls.name}`,
      help: `Choisis-en ${cls.skills.count}. Celles que tu maîtrises déjà ne sont pas proposées.`,
      options: from.map((s) => opt(s)),
      min: cls.skills.count,
      max: cls.skills.count,
    };
  }
  if (d.speciesFeat?.featId === "doue") {
    const s = featStep("speciesFeat", d.speciesFeat, d, "Don d’espèce");
    if (s) return s;
  }
  if (cls.tools.choose === "instruments-3" && !d.classTools)
    return {
      kind: "multi",
      id: "classTools",
      title: "Trois instruments de musique",
      help: "Les instruments déjà maîtrisés ne sont pas proposés.",
      options: MUSICAL_INSTRUMENTS.filter((t) => !heldTools(d).includes(t)).map((t) => opt(t)),
      min: 3,
      max: 3,
    };
  if (cls.tools.choose === "artisan-or-instrument" && !d.classTools)
    return {
      kind: "select",
      id: "classTools",
      title: "Outil d’artisan ou instrument de musique",
      help: "Le même outil figure dans ton équipement de départ.",
      options: [...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS].filter((t) => !heldTools(d).includes(t)).map((t) => opt(t)),
    };
  if (cls.expertise && !d.expertise) {
    const held = heldSkills(d);
    return {
      kind: "multi",
      id: "expertise",
      title: "Expertise",
      help: `Deux de tes compétences maîtrisées. Escamotage et Discrétion sont recommandés si tu les as.`,
      options: held.map((s) => opt(s)),
      min: cls.expertise,
      max: cls.expertise,
    };
  }
  if (cls.weaponMastery && !d.masteries) {
    const options = weaponMasteryOptions(d);
    return {
      kind: "multi",
      id: "masteries",
      title: "Bottes d’arme",
      help: `Choisis ${cls.weaponMastery.count} types d’arme.`,
      options,
      min: cls.weaponMastery.count,
      max: cls.weaponMastery.count,
    };
  }
  const sc = cls.spellcasting;
  if (sc) {
    const cantripCount = classCantripCount(d);
    if (cantripCount > 0 && !d.cantrips)
      return {
        kind: "multi",
        id: "cantrips",
        title: `Sorts mineurs de ${cls.name}`,
        help: `Choisis-en ${cantripCount}. Les sorts mineurs déjà connus ne sont pas proposés.`,
        options: spellOptions(sc.list, 0, knownCantrips(d)),
        min: cantripCount,
        max: cantripCount,
      };
    const exclude = sc.alwaysPrepared ?? [];
    if (sc.spellbook && !d.spellbook)
      return {
        kind: "multi",
        id: "spellbook",
        title: "Grimoire : six sorts du 1er niveau",
        options: spellOptions(sc.list, 1, exclude),
        min: sc.spellbook,
        max: sc.spellbook,
      };
    if (!d.prepared) {
      if (sc.spellbook) {
        return {
          kind: "multi",
          id: "prepared",
          title: `Sorts préparés (${sc.prepared} dans ton grimoire)`,
          options: (d.spellbook ?? []).map((n) => {
            const s = spellsFor(sc.list, 1).find((x) => x.name === n)!;
            return spellOption(s);
          }),
          min: sc.prepared,
          max: sc.prepared,
        };
      }
      return {
        kind: "multi",
        id: "prepared",
        title: `Sorts préparés du 1er niveau`,
        help: sc.alwaysPrepared ? `${sc.alwaysPrepared.join(", ")} est toujours préparé et n’est pas compté.` : undefined,
        options: spellOptions(sc.list, 1, exclude),
        min: sc.prepared,
        max: sc.prepared,
      };
    }
  }
  if (cls.invocation) {
    if (!d.invocation)
      return {
        kind: "select",
        id: "invocation",
        title: "Manifestation occulte",
        help: "Seules les manifestations sans prérequis sont proposées au niveau 1.",
        options: Object.keys(INVOCATIONS).map((n) => opt(n)),
      };
    if (d.invocation === "Pacte du grimoire") {
      if (!d.pactCantrips)
        return {
          kind: "multi",
          id: "pactCantrips",
          title: "Pacte du grimoire : trois sorts mineurs",
          help: "Liste de n’importe quelle classe.",
          options: allSpells(0)
            .filter((s) => !knownCantrips(d).includes(s.name))
            .map(spellOption),
          min: 3,
          max: 3,
        };
      if (!d.pactRituals)
        return {
          kind: "multi",
          id: "pactRituals",
          title: "Pacte du grimoire : deux sorts rituels du 1er niveau",
          help: "Liste de n’importe quelle classe, sorts que tu n’as pas déjà préparés.",
          options: allSpells(1, true)
            .filter((s) => !(d.prepared ?? []).includes(s.name))
            .map(spellOption),
          min: 2,
          max: 2,
        };
    }
  }

  // 9. Équipement
  if (!d.equipment)
    return {
      kind: "select",
      id: "equipment",
      title: "Équipement de départ",
      help: "L’option en pièces d’or ne donne aucun objet ici : tu achèteras ton équipement avec le MJ.",
      options: cls.equipment.map((e) => opt(e.id, `Option ${e.id}`, equipmentSummary(cls, e.id))),
    };
  const eq = cls.equipment.find((e) => e.id === d.equipment)!;
  if (eq.items.some((i) => i.kind === "choice" && i.what === "instrument") && !d.instrument)
    return {
      kind: "select",
      id: "instrument",
      title: "Instrument de musique de départ",
      options: MUSICAL_INSTRUMENTS.map((t) => opt(t)),
    };

  // Sans option A connue, l'historique donne l'option B (pièces d'or) : rien à demander.
  if (bg.equipmentA && !d.backgroundEquipment)
    return {
      kind: "select",
      id: "backgroundEquipment",
      title: `Équipement d’historique (${bg.name})`,
      help: "Un ensemble d’équipement ou 50 po.",
      options: [
        opt("A", "Option A", `${bg.equipmentA.join(", ")} et ${bg.goldA} po`),
        opt("B", "Option B", `${bg.goldB} po`),
      ],
    };
  if (d.backgroundEquipment === "A" && bg.equipmentA?.some((i) => i.startsWith("Boîte de jeux")) && !d.gamingSet)
    return {
      kind: "select",
      id: "gamingSet",
      title: `${bg.name} : boîte de jeux de l’équipement`,
      options: GAMING_SETS.map((g) => opt(g)),
    };

  // 10. Langues
  if (!d.languages)
    return {
      kind: "multi",
      id: "languages",
      title: "Langues",
      help: "Tu connais le Commun. Choisis-en deux autres dans la table des langues courantes.",
      options: COMMON_LANGUAGES.map((l) => opt(l)),
      min: 2,
      max: 2,
    };
  if (cls.id === "roublard" && !d.extraLanguage)
    return {
      kind: "select",
      id: "extraLanguage",
      title: "Argot des voleurs : une langue de plus",
      help: "Une langue supplémentaire, choisie dans les tables des langues.",
      options: [...COMMON_LANGUAGES, ...RARE_LANGUAGES.filter((l) => l !== "Argot des voleurs")]
        .filter((l) => !d.languages!.includes(l))
        .map((l) => opt(l)),
    };

  // 11. Alignement
  if (!d.alignment)
    return {
      kind: "select",
      id: "alignment",
      title: "Alignement",
      options: ALIGNMENTS.map((a) => opt(a)),
    };

  // 12. Description (facultative)
  if (!d.storyDone)
    return {
      kind: "story",
      id: "story",
      title: "Origine, apparence, personnalité et histoire",
      help: "Facultatif. L’origine (lieu, milieu, famille) est un récit libre : elle ne donne aucune maîtrise ni bonus, ceux-ci viennent de l’historique, de la classe, de l’espèce et des dons. Tu peux écrire ton texte ou demander des idées à l’assistant.",
    };

  // 13. Dés lancés à la table : saisie des résultats, puis répartition (étape 7).
  if (method === "table" && !d.rolls)
    return {
      kind: "table",
      id: "tableRolls",
      title: "Caractéristiques : dés lancés à la table",
      help: "Tout le reste est prêt. À la table, lance 4d6 six fois et garde les trois meilleurs dés de chaque lancer, puis saisis les six totaux : tu les répartiras ensuite, et la fiche sera remplie.\nEn attendant, le bouton « Fiche à cases vides » donne un PDF à imprimer : tout ce qui dépend des caractéristiques est à compléter au crayon, l’annexe indique comment.",
    };

  return { kind: "done", id: "done" };
}

export type ApplyResult = { ok: true; draft: Draft } | { ok: false; error: string };

/**
 * Applique la réponse du joueur à l'étape `id`. Retourne un nouveau brouillon ;
 * les choix qui en dépendent sont réinitialisés quand une réponse antérieure change.
 */
export function applyAnswer(draft: Draft, id: string, values: string[], rng?: () => number): ApplyResult {
  const step = nextStep(draft);
  if (step.id !== id) return { ok: false, error: "Cette étape n’est plus d’actualité." };
  const d: Draft = structuredClone(draft);
  const one = values[0];

  if (step.kind === "confirm" && values[0] !== "ok") return { ok: false, error: "Confirmation attendue." };
  if (step.kind === "select" && (values.length !== 1 || !step.options.some((o) => o.value === one)))
    return { ok: false, error: "Choix invalide." };
  if (step.kind === "multi") {
    const set = new Set(values);
    if (set.size !== values.length) return { ok: false, error: "Choix en double." };
    if (values.length < step.min || values.length > step.max)
      return { ok: false, error: step.min === step.max ? `Choisis exactement ${step.min} élément(s).` : `Choisis entre ${step.min} et ${step.max} éléments.` };
    if (values.some((v) => !step.options.some((o) => o.value === v))) return { ok: false, error: "Choix invalide." };
  }

  const featTarget = (prefix: string): FeatChoice | undefined =>
    prefix === "speciesFeat" ? d.speciesFeat : (d.backgroundFeat ??= initialBackgroundFeat(d));

  switch (id) {
    case "name":
      return { ok: true, draft: { ...d, name: values[0] ?? "" } };
    case "class":
      d.classId = one;
      break;
    case "species":
      d.speciesId = one;
      break;
    case "speciesOption":
      d.speciesOption = one;
      break;
    case "speciesAbility":
      d.speciesAbility = one as Ability;
      break;
    case "size":
      d.size = one as "M" | "P";
      break;
    case "background":
      d.backgroundId = one;
      break;
    case "speciesSkill":
      d.speciesSkill = one;
      break;
    case "speciesFeat":
      d.speciesFeat = { featId: one! };
      break;
    case "gamingSet":
      d.gamingSet = one;
      break;
    case "backgroundTool":
      d.backgroundTool = one;
      break;
    case "rules":
      d.rulesAck = true;
      break;
    case "method":
      d.method = one as Draft["method"];
      break;
    case "assignMode": {
      d.assignMode = one as Draft["assignMode"];
      const sug = d.classId ? STANDARD_BY_CLASS[d.classId] : undefined;
      if (one === "suggested" && sug) {
        if (methodOf(d) === "points") d.points = { ...sug };
        else {
          const values = valuesOf(d) ?? [];
          const byValue = values.map((v, i) => ({ v, i })).sort((x, y) => y.v - x.v);
          const byNeed = [...ABILITIES].sort((x, y) => sug[y] - sug[x]);
          d.assignment = Object.fromEntries(byNeed.map((a, k) => [a, byValue[k]!.i]));
        }
      }
      break;
    }
    case "roll": {
      const rolled = rollAbilityScores(rng);
      d.rolls = rolled.map((r) => r.total);
      d.rollDice = rolled.map((r) => r.dice);
      break;
    }
    case "tableRolls": {
      const rolls = values.map((v) => Number(v));
      if (rolls.length !== 6 || rolls.some((n) => !Number.isInteger(n) || n < 3 || n > 18))
        return { ok: false, error: "Il faut six totaux, chacun entre 3 et 18 (4d6, trois meilleurs dés)." };
      d.rolls = rolls;
      break;
    }
    case "bonusMode":
      d.bonusMode = one as "2-1" | "1-1-1";
      break;
    case "bonusPlus2":
      d.bonusPlus2 = one as Ability;
      break;
    case "bonusPlus1":
      d.bonusPlus1 = one as Ability;
      break;
    case "order":
      d.order = one;
      break;
    case "fightingStyle":
      d.fightingStyle = one;
      break;
    case "classSkills":
      d.classSkills = values;
      break;
    case "classTools":
      d.classTools = values;
      break;
    case "expertise":
      d.expertise = values;
      break;
    case "masteries":
      d.masteries = values;
      break;
    case "cantrips":
      d.cantrips = values;
      break;
    case "spellbook":
      d.spellbook = values;
      break;
    case "prepared":
      d.prepared = values;
      break;
    case "invocation":
      d.invocation = one;
      break;
    case "pactCantrips":
      d.pactCantrips = values;
      break;
    case "pactRituals":
      d.pactRituals = values;
      break;
    case "equipment":
      d.equipment = one as "A" | "B" | "C";
      break;
    case "instrument":
      d.instrument = one;
      break;
    case "backgroundEquipment":
      d.backgroundEquipment = one as "A" | "B";
      break;
    case "languages":
      d.languages = values;
      break;
    case "extraLanguage":
      d.extraLanguage = one;
      break;
    case "alignment":
      d.alignment = one;
      break;
    case "story": {
      try {
        const parsed = JSON.parse(one ?? "{}") as Record<string, unknown>;
        const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 1500) : undefined);
        const story = {
          origin: clean(parsed.origin),
          appearance: clean(parsed.appearance),
          personality: clean(parsed.personality),
          backstory: clean(parsed.backstory),
        };
        d.story = Object.fromEntries(Object.entries(story).filter(([, v]) => v !== undefined));
        d.storyDone = true;
      } catch {
        return { ok: false, error: "Texte invalide." };
      }
      break;
    }
    default: {
      const m = /^(speciesFeat|backgroundFeat)\.(picks|list|ability|cantrips|spell)$/.exec(id);
      if (m) {
        const f = featTarget(m[1]!);
        if (!f) return { ok: false, error: "Don introuvable." };
        if (m[2] === "picks") f.picks = values;
        else if (m[2] === "list") f.spellList = one as FeatChoice["spellList"];
        else if (m[2] === "ability") f.ability = one as Ability;
        else if (m[2] === "cantrips") f.cantrips = values;
        else f.spell = one;
        break;
      }
      const pb = /^pb\.(FOR|DEX|CON|INT|SAG|CHA)$/.exec(id);
      if (pb) {
        d.points = { ...(d.points ?? {}), [pb[1] as Ability]: Number(one) };
        break;
      }
      const a = /^assign\.(FOR|DEX|CON|INT|SAG|CHA)$/.exec(id);
      if (a) {
        d.assignment = { ...(d.assignment ?? {}), [a[1] as Ability]: Number(one) };
        break;
      }
      return { ok: false, error: "Étape inconnue." };
    }
  }
  return { ok: true, draft: d };
}

function initialBackgroundFeat(d: Draft): FeatChoice | undefined {
  const bg = backgroundOf(d);
  if (!bg) return undefined;
  return { featId: bg.featId, ...(bg.featSpellList ? { spellList: bg.featSpellList } : {}) };
}

export function isComplete(d: Draft): boolean {
  return nextStep(d).kind === "done";
}

export { finalScores, armorTrainingOf, speciesOptionOf, FEATS };
