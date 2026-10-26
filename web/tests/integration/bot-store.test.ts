import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { openStore } from "@bot/db";
import { draftOf, newState } from "@bot/character/state";
import { nextStep } from "@bot/character/steps";

const dir = mkdtempSync(join(tmpdir(), "jdr-store-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("base partagée avec le bot", () => {
  it("un brouillon enregistré par un processus est relu par un autre", () => {
    const path = join(dir, "jdr.sqlite");
    const bot = openStore(path);
    const site = openStore(path);
    bot.saveWizard("serveur", "joueur", newState("Rek'tal"));

    const state = site.getWizard("serveur", "joueur");
    expect(state?.name).toBe("Rek'tal");
    expect(nextStep(draftOf(state!))).toMatchObject({ id: expect.any(String) });
  });
});
