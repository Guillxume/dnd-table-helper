import { describe, expect, it } from "vitest";
import { libraryFiltersToSearchParams, parseLibraryFilters } from "../../src/lib/library-filters";
import { safeRedirectPath } from "../../src/lib/safe-redirect";
import { escapeLike, normalizeForSearch, searchTerms } from "../../src/lib/search/normalize";
import { slugify, titleFromFilename } from "../../src/lib/text";

describe("normalisation de recherche", () => {
  it("ignore casse, accents et ligatures", () => {
    expect(normalizeForSearch("Élamaër CŒUR Rek’tal")).toBe("elamaer coeur rek'tal");
  });

  it("découpe en termes, borne leur nombre", () => {
    expect(searchTerms("  Clerc   lumière ")).toEqual(["clerc", "lumiere"]);
    expect(searchTerms("a b c d e f g h i j")).toHaveLength(8);
    expect(searchTerms(undefined)).toEqual([]);
  });

  it("échappe les jokers LIKE", () => {
    expect(escapeLike("100%_\\")).toBe("100\\%\\_\\\\");
  });
});

describe("filtres de la galerie", () => {
  const uuid = "0199f2a6-1c1e-7d4b-9a3e-2f5c8b7d6e10";

  it("lit des paramètres valides et ignore les invalides", () => {
    const filters = parseLibraryFilters({
      q: " paladin ",
      tag: [uuid, "pas-un-uuid", uuid],
      category: "invalide",
      origin: "GENERATED",
      favorite: "1",
      from: "2026-01-01",
      to: "2026-13-45",
      sort: "inconnu",
    });
    expect(filters).toEqual({
      q: "paladin",
      tagIds: [uuid],
      categoryId: undefined,
      collectionId: undefined,
      favorite: true,
      origin: "GENERATED",
      importedFrom: "2026-01-01",
      importedTo: undefined,
      sort: "imported-desc",
    });
  });

  it("produit des paramètres d'URL relus à l'identique", () => {
    const filters = parseLibraryFilters({ q: "elfe", tag: [uuid], favorite: "1", sort: "title-asc" });
    const params = libraryFiltersToSearchParams(filters);
    expect(params.toString()).toBe(`q=elfe&tag=${uuid}&favorite=1&sort=title-asc`);
    expect(parseLibraryFilters(Object.fromEntries(params))).toEqual(filters);
  });
});

describe("redirection après connexion", () => {
  it.each([
    ["/library?tag=x", "/library?tag=x"],
    ["https://exemple.com", "/"],
    ["//exemple.com/x", "/"],
    ["/\\exemple.com", "/"],
    ["/login", "/"],
    [undefined, "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});

describe("textes", () => {
  it("dérive un slug et un titre lisibles", () => {
    expect(slugify("Fiches de personnages illustrées")).toBe("fiches-de-personnages-illustrees");
    expect(titleFromFilename("clerc_lumiere-divine.final.png")).toBe("clerc lumiere divine.final");
    expect(titleFromFilename(".png")).toBe("Sans titre");
  });
});
