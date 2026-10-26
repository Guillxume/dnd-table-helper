import { describe, expect, it, vi } from "vitest";
import { openStore, type Store } from "../src/db.js";
import { budget, evaluate, parseCreatureList, parseDifficulty, renderEncounter } from "../src/encounter.js";
import { creatures, matchCreature } from "../src/srd/creatures.js";
import { glossaryEntry, lookup, lookupChoices } from "../src/lookup.js";
import { SRD_SUBCLASSES, subclassText } from "../src/srd/subclasses.js";
import { applyCarnet, parseCarnet, renderCarnet } from "../src/carnet.js";
import { campaignProgress, renderProgress } from "../src/tracking.js";
import { BRING_LINE, deadlineText, sendDeadlineReminders, sendDueReminders, sendNoteCalls } from "../src/schedule.js";
import { groupRow, renderGroupSheet } from "../src/group-sheet.js";
import { renderStatBlocks } from "../src/statblocks.js";
import { decodePicks, encodePicks, mjPanel, playerPanel, setDeadline } from "../src/panel.js";
import { creatureListChoices } from "../src/commands.js";
import { summarizeNotes } from "../src/summarize.js";
import { newState } from "../src/character/state.js";
import { autoplay } from "./helpers.js";

function campaignStore(): Store {
  const store = openStore(":memory:");
  store.createCampaign({ channelId: "c1", guildId: "g", name: "Les Mines", mjRoleId: "mj" });
  store.setCampaignStructure("c1", { playerRoleId: "pj", prepChannelId: "aide" });
  return store;
}

/** Faux client Discord : enregistre les messages envoyés par salon. */
function fakeClient(fail: (id: string) => boolean = () => false) {
  const sent: { channel: string; msg: any }[] = [];
  const client = {
    channels: {
      fetch: async (id: string) => ({
        isSendable: () => true,
        send: async (msg: any) => {
          if (fail(id)) throw new Error("Missing Permissions");
          sent.push({ channel: id, msg });
        },
      }),
    },
  } as any;
  return { client, sent };
}

describe("budget de rencontre (SRD 5.2.1 p. 213)", () => {
  it("reprend la table et les exemples du SRD", () => {
    // Exemple 1 du SRD : difficulté faible, 4 personnages de niveau 1 = 200 PX.
    expect(budget(1, 4, "faible")).toBe(200);
    // Exemple 2 : modérée, 5 personnages de niveau 3 = 1 125 PX.
    expect(budget(3, 5, "moderee")).toBe(1125);
    // Exemple 3 : élevée, 6 personnages de niveau 15 = 46 800 PX.
    expect(budget(15, 6, "elevee")).toBe(46800);
  });

  it("lit les FP et PX des créatures sous leurs deux écritures", () => {
    expect(creatures().length).toBeGreaterThan(300);
    const wolf = matchCreature("loups");
    expect("creature" in wolf && wolf.creature.xp).toBe(50);
    const dragon = matchCreature("Dragon noir adulte"); // écrit « FP 14 (PX 11 500… » dans le SRD
    expect("creature" in dragon && dragon.creature.xp).toBe(11500);
    expect("creature" in dragon && dragon.creature.crValue).toBe(14);
  });

  it("refuse de deviner un nom ambigu et signale les créatures inconnues", () => {
    const r = parseCreatureList("4 combattants gobelins, gobelins, loup x2, bidule");
    expect(r.picks.map((p) => [p.creature.name, p.count])).toEqual([
      ["Combattant gobelin", 4],
      ["Loup", 2],
    ]);
    expect(r.unknown[0]).toMatch(/préciser : .*Chef gobelin/);
    expect(r.unknown).toContain("bidule");
  });

  it("évalue la difficulté atteinte et prévient des pièges du SRD", () => {
    const { picks } = parseCreatureList("1 chef gobelin");
    const r = evaluate(picks, 1, 4, "moderee");
    expect(r.total).toBe(200);
    expect(r.reached).toBe("faible");
    expect(r.warnings).toEqual([]); // FP 1 pour un groupe de niveau 1 : pas « supérieur »
    expect(renderEncounter(picks, [], 1, 4, "moderee")).toContain("Dans le budget (reste 100 PX)");
    const ogre = evaluate(parseCreatureList("ogre").picks, 1, 4, "moderee");
    expect(ogre.warnings.join(" ")).toMatch(/FP supérieur au niveau du groupe \(Ogre, FP 2\)/);
    expect(parseDifficulty("Élevée")).toBe("elevee");
    expect(parseDifficulty("n’importe quoi")).toBeUndefined();
  });

  it("code la rencontre dans un identifiant de bouton et la relit", () => {
    const { picks } = parseCreatureList("4 combattants gobelins, 1 chef gobelin");
    const code = encodePicks(picks)!;
    expect(`enc:pdf:${code}`.length).toBeLessThanOrEqual(100);
    expect(decodePicks(code).map((p) => [p.creature.name, p.count])).toEqual(picks.map((p) => [p.creature.name, p.count]));
  });

  it("complète la dernière créature tapée sans perdre le début", () => {
    const choices = creatureListChoices("4 combattants gobelins, 2 lou");
    expect(choices[0]?.value).toBe("4 combattants gobelins, 2 Loup");
    for (const c of choices) expect(c.value.length).toBeLessThanOrEqual(100);
  });

  it("produit un PDF des blocs de statistiques", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(await renderStatBlocks("Test", parseCreatureList("loup x2, chef gobelin").picks));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});

describe("recherche unique", () => {
  it("trouve sorts, objets, créatures et états du glossaire", () => {
    expect(lookupChoices("bou").some((c) => c.value === "sort:Bouclier")).toBe(true);
    for (const c of lookupChoices("")) expect(c.name.length).toBeLessThanOrEqual(100);
    expect(lookup("sort:Projectile magique")[0]).toContain("Sort de niveau 1");
    expect(lookup("creature:Loup")[0]).toContain("FP 1/4");
    expect(lookup("Épée longue")[0]).toContain("Épée longue");
    expect(glossaryEntry("agrippé")).toMatch(/^\*\*Agrippé \[État\]\*\*/);
    expect(lookup("repos long")[0]).toContain("Dans le SRD 5.2.1");
    for (const m of lookup("repos long")) expect(m.length).toBeLessThanOrEqual(2000);
  });

  it("couvre les données de création et tous les documents du MJ (ref/)", () => {
    // Espèce hors SRD : fiche du bot puis ligne du référentiel d'origines.
    const aasimar = lookup("Aasimar").join("\n");
    expect(aasimar).toContain("Résistance céleste");
    expect(aasimar).toContain("Référentiel d’origines du MJ");
    expect(lookup("Artisan")[0]).toContain("Fabricant");
    expect(lookup("Loyal bon")[0]).toContain("Référentiel d’origines du MJ");
    // « Berserker » : la créature du SRD et la sous-classe des documents du MJ.
    const berserker = lookup("Berserker").join("\n");
    expect(berserker).toContain("FP 2");
    expect(berserker).toContain("Berserker (Barbare)");
    expect(lookup("trajectoire magicien")[0]).toContain("Trajectoire : Magicien");
    expect(lookupChoices("aas").map((c) => c.value)).toEqual(["espece:aasimar", "ref:1"]);
    // Sous-classes : les 48 des documents du MJ, et le texte officiel des 12 du SRD, quel que soit le nom tapé.
    for (const sc of SRD_SUBCLASSES) expect(subclassText(sc, 200), sc.name).toBeTruthy();
    const voie = lookup("Berserker").join("\n");
    expect(voie).toContain("Voie du Berserker** (sous-classe de Barbare");
    expect(lookup("Main ouverte").join("\n")).toContain("Credo de la Paume");
    expect(lookup("Zélote")[0]).toContain("Zélote (Barbare)");
    expect(lookupChoices("zél").map((c) => c.name)).toEqual(["Zélote (Barbare) (guide du MJ)", "Zélote (Barbare) (trajectoires du MJ)"]);
    // Recherche libre : trois messages au plus.
    expect(lookup("sous-classe barbare").length).toBeLessThanOrEqual(3);
  });
});

describe("carnet de campagne", () => {
  it("lit le JSON du modèle même entouré de texte, et ignore les entrées sans nom", () => {
    const e = parseCarnet('Voici : {"pnj":[{"nom":"Maître Orin","detail":"forgeron méfiant"},{"nom":""}],"lieux":[],"objets":[{"nom":"Clé de bronze"}],"fils":[{"nom":"Qui a volé la relique ?"}]} fin');
    expect(e.pnj).toEqual([{ nom: "Maître Orin", detail: "forgeron méfiant" }]);
    expect(e.objets[0]?.detail).toBe("");
    expect(() => parseCarnet("pas de json")).toThrow();
  });

  it("fusionne les entrées d'une séance à l'autre et remplace les fils ouverts", () => {
    const store = campaignStore();
    applyCarnet(store, "c1", { pnj: [{ nom: "Maître Orin", detail: "forgeron" }], lieux: [], objets: [], fils: [{ nom: "Trouver la relique", detail: "" }] }, 1);
    const summary = applyCarnet(store, "c1", { pnj: [{ nom: "maitre orin", detail: "" }], lieux: [{ nom: "Valbourg", detail: "" }], objets: [], fils: [] }, 2);
    expect(summary).toBe("1 PNJ, 1 lieu, 0 objet, 0 fil ouvert");
    const list = store.listCarnet("c1");
    const orin = list.find((x) => x.kind === "pnj")!;
    expect([orin.name, orin.detail, orin.firstSession, orin.lastSession]).toEqual(["Maître Orin", "forgeron", 1, 2]);
    expect(list.some((x) => x.kind === "fil")).toBe(false);
    expect(renderCarnet("Les Mines", list)).toContain("**Maître Orin** : forgeron (séances 1 à 2)");
    expect(store.removeCarnet("c1", "lieu", "VALBOURG")).toBe(true);
    store.close();
  });
});

describe("notes des joueurs", () => {
  it("une note par joueur en attente, rattachée au rappel publié", () => {
    const store = campaignStore();
    store.savePlayerNote("c1", "u1", "première");
    store.savePlayerNote("c1", "u1", "corrigée");
    store.savePlayerNote("c1", "u2", "autre");
    expect(store.pendingPlayerNotes("c1").map((n) => n.text)).toEqual(["corrigée", "autre"]);
    store.markPlayerNotesUsed("c1", 3);
    expect(store.pendingPlayerNotes("c1")).toEqual([]);
    store.close();
  });

  it("sont transmises au modèle comme complément des notes du MJ", async () => {
    let seen = "";
    await summarizeNotes(async (_s, u) => ((seen = u), "ok"), "notes du MJ", "", [{ author: "Alice", text: "le forgeron ment" }]);
    expect(seen).toContain("Notes de séance du MJ");
    expect(seen).toContain("- Alice : le forgeron ment");
  });

  it("l'appel aux notes part le lendemain matin, une seule fois, même si la séance suivante est déjà fixée", async () => {
    const store = campaignStore();
    store.setNextSession("c1", "2026-11-21T19:30:00.000Z", "");
    // Le MJ fixe la séance suivante à la fin de la séance : l'ancienne date reste connue pour l'appel aux notes.
    vi.useFakeTimers({ now: new Date("2026-11-21T23:00:00Z") });
    try {
      store.setNextSession("c1", "2026-12-05T19:30:00.000Z", "");
    } finally {
      vi.useRealTimers();
    }
    const { client, sent } = fakeClient();
    expect(await sendNoteCalls(client, store, new Date("2026-11-22T05:00:00Z"))).toBe(0); // trop tôt
    expect(await sendNoteCalls(client, store, new Date("2026-11-22T10:00:00Z"))).toBe(1);
    expect(await sendNoteCalls(client, store, new Date("2026-11-22T12:00:00Z"))).toBe(0);
    expect(sent[0]!.msg.components[0].components[0].data.custom_id).toBe("panel:notes:c1");
    store.close();
  });
});

describe("rappel de la veille", () => {
  it("rappelle quoi apporter et joint le rappel de la séance précédente", async () => {
    const store = campaignStore();
    store.addSession("c1", "notes", "**Résumé**\nLes héros ont fui la crypte.");
    store.setNextSession("c1", "2026-11-21T19:30:00.000Z", "");
    const { client, sent } = fakeClient();
    expect(await sendDueReminders(client, store, new Date("2026-11-21T08:00:00Z"))).toBe(1);
    expect(sent[0]!.msg.content).toContain(BRING_LINE);
    expect(sent[1]!.msg.content).toContain("rappel de la séance 1");
    expect(sent[1]!.msg.content).toContain("Les héros ont fui la crypte.");
    expect(sent[1]!.msg.allowedMentions).toEqual({ parse: [] });
    store.close();
  });
});

describe("suivi des personnages et échéance", () => {
  const draft = () => autoplay({ classId: "guerrier", speciesId: "humain", backgroundId: "soldat" });

  it("classe les joueurs : terminé, en cours, pas commencé", () => {
    const store = campaignStore();
    for (const u of ["u1", "u2", "u3"]) store.addPlayer("c1", u);
    store.addCharacter("g", "u1", "c1", "Bran", draft());
    store.saveWizard("g", "u2", { ...newState("Lyra", store.getCampaign("c1")!.creationRules), campaignId: "c1", campaignName: "Les Mines" });
    const p = campaignProgress(store, store.getCampaign("c1")!);
    expect(p.done.map((d) => d.userId)).toEqual(["u1"]);
    expect(p.inProgress).toEqual([{ userId: "u2", name: "Lyra" }]);
    expect(p.notStarted).toEqual(["u3"]);
    expect(renderProgress(store.getCampaign("c1")!, p)).toContain("Pas commencés (1)");
    store.close();
  });

  it("un joueur qui n'attend que le tirage à la table est à part et n'est pas relancé", async () => {
    const { answer, newState: fresh } = await import("../src/character/state.js");
    const { nextStep } = await import("../src/character/steps.js");
    const { draftOf } = await import("../src/character/state.js");
    const store = campaignStore();
    store.addPlayer("c1", "u1");
    let s = { ...fresh("Lyra", { level: 1, methods: ["table"], content: "manuel" as const }), campaignId: "c1", campaignName: "Les Mines" };
    for (let n = 0; n < 200 && nextStep(draftOf(s)).kind !== "table"; n++) {
      const step = nextStep(draftOf(s));
      const values =
        step.kind === "confirm" ? ["ok"] : step.kind === "story" ? ["{}"] : step.kind === "select" ? [step.options[0]!.value] : step.kind === "multi" ? step.options.slice(0, step.min).map((o) => o.value) : [];
      const r = answer(s, step.id, values);
      if (!r.ok) throw new Error(r.error);
      s = r.state as typeof s;
    }
    store.saveWizard("g", "u1", s);
    const p = campaignProgress(store, store.getCampaign("c1")!);
    expect(p.inProgress).toEqual([]);
    expect(p.awaitingTable).toEqual([{ userId: "u1", name: "Lyra" }]);
    expect(renderProgress(store.getCampaign("c1")!, p)).toContain("caractéristiques à tirer à la table (1)");
    store.setCreationDeadline("c1", "2026-11-11T22:59:00.000Z");
    expect(deadlineText(store, store.getCampaign("c1")!, 3)).toBeUndefined();
    store.close();
  });

  it("relance à J-3 puis à J-1 ceux qui n'ont pas fini, une fois chacune", async () => {
    const store = campaignStore();
    store.addPlayer("c1", "u1");
    store.addPlayer("c1", "u2");
    store.addCharacter("g", "u1", "c1", "Bran", draft());
    expect(setDeadline({ store } as any, store.getCampaign("c1")!, "11/11/2026", new Date("2026-10-15T10:00:00Z"))).toContain("Échéance");
    const { client, sent } = fakeClient();
    expect(await sendDeadlineReminders(client, store, new Date("2026-11-01T10:00:00Z"))).toBe(0); // trop tôt
    expect(await sendDeadlineReminders(client, store, new Date("2026-11-09T10:00:00Z"))).toBe(1); // J-3
    expect(await sendDeadlineReminders(client, store, new Date("2026-11-09T18:00:00Z"))).toBe(0);
    expect(await sendDeadlineReminders(client, store, new Date("2026-11-11T08:00:00Z"))).toBe(1); // J-1
    expect(await sendDeadlineReminders(client, store, new Date("2026-11-11T12:00:00Z"))).toBe(0);
    expect(sent[0]!.msg.content).toContain("<@u2>");
    expect(sent[0]!.msg.content).not.toContain("<@u1>");
    expect(sent[0]!.msg.allowedMentions).toEqual({ users: ["u2"] });
    store.close();
  });

  it("ne relance personne quand tout le monde a fini", () => {
    const store = campaignStore();
    store.addPlayer("c1", "u1");
    store.addCharacter("g", "u1", "c1", "Bran", draft());
    store.setCreationDeadline("c1", "2026-11-11T22:59:00.000Z");
    expect(deadlineText(store, store.getCampaign("c1")!, 3)).toBeUndefined();
    store.close();
  });

  it("refuse une échéance passée et accepte « aucune »", () => {
    const store = campaignStore();
    const c = store.getCampaign("c1")!;
    expect(setDeadline({ store } as any, c, "01/10/2026", new Date("2026-10-15T10:00:00Z"))).toMatch(/passée/);
    expect(setDeadline({ store } as any, c, "aucune")).toMatch(/Plus d’échéance/);
    expect(store.getCampaign("c1")!.creationDeadline).toBeNull();
    store.close();
  });
});

describe("fiche de groupe", () => {
  it("donne les valeurs utiles au MJ, sur une page", async () => {
    const d = autoplay({ classId: "magicien", speciesId: "elfe", backgroundId: "sage" });
    const r = groupRow({ name: "Lyra", player: "Alice", draft: d });
    expect(Number(r.ac)).toBeGreaterThan(0);
    expect(r.hp).toMatch(/^\d+ \(1d6\)$/);
    expect(r.spells).toMatch(/^Magicien : DD \d+, att\. \+\d+/);
    expect(r.saves).toContain("INT");
    const { PDFDocument } = await import("pdf-lib");
    const store = campaignStore();
    const members = ["guerrier", "magicien", "clerc", "roublard", "barde"].map((classId, k) => ({
      name: `PJ ${k}`,
      player: `Joueur ${k}`,
      draft: autoplay({ classId, speciesId: "humain", backgroundId: "acolyte" }),
    }));
    const pdf = await PDFDocument.load(await renderGroupSheet(store.getCampaign("c1")!, members));
    expect(pdf.getPageCount()).toBe(1);
    store.close();
  });
});

describe("tableaux de bord", () => {
  it("respectent les limites de Discord", () => {
    const store = campaignStore();
    const c = store.getCampaign("c1")!;
    for (const panel of [playerPanel(c), mjPanel(c)]) {
      expect(panel.content.length).toBeLessThanOrEqual(2000);
      expect(panel.components.length).toBeLessThanOrEqual(5);
      for (const r of panel.components) {
        const buttons = r.components as any[];
        expect(buttons.length).toBeLessThanOrEqual(5);
        for (const b of buttons) {
          expect(b.data.custom_id.length).toBeLessThanOrEqual(100);
          expect(b.data.label.length).toBeLessThanOrEqual(80);
        }
      }
    }
    store.close();
  });

  it("gardent leurs identifiants de message", () => {
    const store = campaignStore();
    store.setPanels("c1", { panelMessageId: "m1" });
    store.setPanels("c1", { mjPanelMessageId: "m2" });
    expect([store.getCampaign("c1")!.panelMessageId, store.getCampaign("c1")!.mjPanelMessageId]).toEqual(["m1", "m2"]);
    store.close();
  });
});
