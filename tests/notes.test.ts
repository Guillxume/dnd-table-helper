import { describe, expect, it } from "vitest";
import { buildNotesModal } from "../src/commands.js";
import { MAX_NOTES_LENGTH, NOTE_FIELDS, formatNotes, maxFormattedLength } from "../src/notes.js";

describe("formulaire de notes", () => {
  it("respecte les limites Discord (5 champs, label 45, placeholder 100, 4000)", () => {
    expect(NOTE_FIELDS.length).toBeLessThanOrEqual(5);
    for (const f of NOTE_FIELDS) {
      expect(f.label.length).toBeLessThanOrEqual(45);
      expect(f.placeholder.length).toBeLessThanOrEqual(100);
      expect(f.maxLength).toBeLessThanOrEqual(4000);
    }
    expect(new Set(NOTE_FIELDS.map((f) => f.id)).size).toBe(NOTE_FIELDS.length);
    expect(() => buildNotesModal().toJSON()).not.toThrow();
  });

  it("le texte assemblé ne peut pas dépasser la limite du service", () => {
    expect(maxFormattedLength()).toBeLessThanOrEqual(MAX_NOTES_LENGTH);
  });

  it("omet les rubriques vides et garde l'ordre", () => {
    const text = formatNotes({ events: " Embuscade ", npcs: "", places: "La crypte", loot: "  ", open: "Le voleur" });
    expect(text).toBe(
      "Déroulement de la séance :\nEmbuscade\n\nLieux :\nLa crypte\n\nFils ouverts et prochaine étape :\nLe voleur",
    );
  });

  it("renvoie une chaîne vide si tout est vide", () => {
    expect(formatNotes({})).toBe("");
  });
});
