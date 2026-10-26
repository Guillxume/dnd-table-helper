import { describe, expect, it } from "vitest";
import { parseTheme } from "@/lib/theme";

describe("thème d'affichage", () => {
  it("garde le thème sombre par défaut et n'accepte que les valeurs connues", () => {
    expect(parseTheme(undefined)).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("<script>")).toBe("dark");
  });
});
