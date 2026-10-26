/** Paramètres de création fixés par le MJ pour une campagne. */
export type Method = "standard" | "points" | "des" | "table";
export const ALL_METHODS: Method[] = ["standard", "points", "des", "table"];
export type Content = "manuel" | "srd";

export interface CreationRules {
  level: number;
  methods: Method[];
  content: Content;
}

export const DEFAULT_RULES: CreationRules = { level: 1, methods: ["standard", "points", "des"], content: "manuel" };
export const MAX_SUPPORTED_LEVEL = 1;

export const METHOD_NAMES: Record<Method, string> = {
  standard: "Valeurs standard (15, 14, 13, 12, 10, 8)",
  points: "Acquisition par points (27 points)",
  des: "Tirage aléatoire (4d6, trois meilleurs dés)",
  table: "Dés lancés à la table (4d6, trois meilleurs dés, résultats saisis par le joueur)",
};

export const CONTENT_NAMES: Record<Content, string> = {
  manuel: "Manuel des joueurs 2024 (SRD 5.2.1 et référentiel du MJ)",
  srd: "SRD 5.2.1 uniquement",
};

export function describeRules(r: CreationRules): string {
  return [`Niveau de départ : ${r.level}`, `Contenu : ${CONTENT_NAMES[r.content]}`, `Caractéristiques : ${r.methods.map((m) => METHOD_NAMES[m]).join(" ; ")}`].join("\n");
}

export function normalizeRules(raw: unknown): CreationRules {
  const r = (raw ?? {}) as Partial<CreationRules>;
  const methods = Array.isArray(r.methods) ? r.methods.filter((m): m is Method => (ALL_METHODS as unknown[]).includes(m)) : [];
  return {
    level: typeof r.level === "number" ? r.level : DEFAULT_RULES.level,
    methods: methods.length ? methods : DEFAULT_RULES.methods,
    content: r.content === "srd" ? "srd" : "manuel",
  };
}

export type RulesUpdate = {
  level: number | null;
  standard: boolean | null;
  points: boolean | null;
  des: boolean | null;
  table: boolean | null;
  content: string | null;
};

/** Applique les options de /regles. Refuse ce que le bot ne sait pas encore faire. */
export function updateRules(current: CreationRules, u: RulesUpdate): { ok: true; rules: CreationRules } | { ok: false; error: string } {
  if (u.level !== null && u.level > MAX_SUPPORTED_LEVEL)
    return {
      ok: false,
      error: `Le bot ne crée que des personnages de niveau ${MAX_SUPPORTED_LEVEL} : la montée de niveau se fait à la table.`,
    };
  const want = (m: Method, v: boolean | null) => (v === null ? current.methods.includes(m) : v);
  const asked: Record<Method, boolean | null> = { standard: u.standard, points: u.points, des: u.des, table: u.table };
  const methods = ALL_METHODS.filter((m) => want(m, asked[m]));
  if (!methods.length) return { ok: false, error: "Au moins une méthode de caractéristiques doit rester autorisée." };
  return {
    ok: true,
    rules: {
      level: u.level ?? current.level,
      methods,
      content: u.content === "srd" || u.content === "manuel" ? u.content : current.content,
    },
  };
}
