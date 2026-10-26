// Génère src/components/icons/rpg-icons.tsx à partir des SVG du design system (design/icones).
// Relancer après tout ajout ou modification d'icône : node scripts/build-icons.mjs
// Les métadonnées de provenance (C2PA, environ 7,5 Ko par fichier) restent dans les fichiers
// sources : seul le dessin est recopié dans le code.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const sourceDir = join(root, "design/icones");
const target = join(root, "src/components/icons/rpg-icons.tsx");
// Trait affiné par rapport aux fichiers sources (2) : jugé trop épais à l'écran (demande du 20/10/2026).
const STROKE_WIDTH = 1.5;

const toJsx = (markup) =>
  markup
    .replace(/\s+/g, " ")
    .replace(/stroke-width=/g, "strokeWidth=")
    .replace(/stroke-linecap=/g, "strokeLinecap=")
    .replace(/stroke-linejoin=/g, "strokeLinejoin=")
    .replace(/fill-rule=/g, "fillRule=")
    .replace(/clip-rule=/g, "clipRule=")
    .replace(/stroke-dasharray=/g, "strokeDasharray=")
    .replace(/fill-opacity=/g, "fillOpacity=")
    .replace(/stroke-opacity=/g, "strokeOpacity=")
    .trim();

const entries = readdirSync(sourceDir)
  .filter((file) => file.endsWith(".svg"))
  .sort()
  .map((file) => {
    const svg = readFileSync(join(sourceDir, file), "utf8");
    const open = svg.match(/<svg\b[^>]*>/)?.[0];
    if (!open || !open.includes('viewBox="0 0 24 24"')) throw new Error(`${file} : grille 24 × 24 attendue.`);
    const body = svg
      .slice(svg.indexOf(open) + open.length, svg.lastIndexOf("</svg>"))
      .replace(/<metadata>[\s\S]*?<\/metadata>/g, "")
      .replace(/<title>[\s\S]*?<\/title>/g, "");
    if (/<(script|foreignObject|image|use)\b|\son\w+=/i.test(body)) throw new Error(`${file} : contenu non autorisé.`);
    // Les icônes « pleines » remplissent au lieu de tracer : on garde l'attribut de la racine.
    const fill = open.match(/\sfill="([^"]*)"/)?.[1] ?? "none";
    const stroke = open.match(/\sstroke="([^"]*)"/)?.[1] ?? "currentColor";
    // Identifiants internes (masques) rendus uniques par instance : préfixe `u` fourni par useId.
    let jsx = toJsx(body);
    for (const [, id] of jsx.matchAll(/\sid="([^"]+)"/g)) {
      jsx = jsx.replaceAll(`id="${id}"`, `id={\`\${u}${id}\`}`).replaceAll(`"url(#${id})"`, `{\`url(#\${u}${id})\`}`);
    }
    return { name: file.replace(/\.svg$/, ""), fill, stroke, jsx };
  });

const lines = [
  "// Fichier généré par scripts/build-icons.mjs à partir de design/icones : ne pas modifier à la main.",
  'import { type ReactNode, type SVGProps, useId } from "react";',
  'import { cn } from "@/lib/utils";',
  "",
  "type Glyph = { fill: string; stroke: string; body: (u: string) => ReactNode };",
  "",
  "export const RPG_ICONS = {",
  ...entries.map(
    (e) => `  ${JSON.stringify(e.name)}: { fill: ${JSON.stringify(e.fill)}, stroke: ${JSON.stringify(e.stroke)}, body: (${e.jsx.includes("${u}") ? "u" : ""}) => <>${e.jsx}</> },`,
  ),
  "} satisfies Record<string, Glyph>;",
  "",
  "export type RpgIconName = keyof typeof RPG_ICONS;",
  "",
  "/** Icône du design system (24 × 24, couleur du texte). Décorative par défaut ; donner `title` si elle porte un sens seule. */",
  "export function RpgIcon({ name, title, className, ...props }: { name: RpgIconName; title?: string } & SVGProps<SVGSVGElement>) {",
  "  const glyph: Glyph = RPG_ICONS[name];",
  "  // Caractères de useId retirés : l'identifiant sert dans url(#…).",
  "  const uid = `i${useId().replace(/[^a-zA-Z0-9_-]/g, \"\")}-`;",
  "  return (",
  "    <svg",
  '      xmlns="http://www.w3.org/2000/svg"',
  '      viewBox="0 0 24 24"',
  "      fill={glyph.fill}",
  "      stroke={glyph.stroke}",
  `      strokeWidth={${STROKE_WIDTH}}`,
  '      strokeLinecap="round"',
  '      strokeLinejoin="round"',
  "      aria-hidden={title ? undefined : true}",
  '      role={title ? "img" : undefined}',
  "      {...props}",
  '      className={cn("size-6 shrink-0", className)}',
  "    >",
  "      {title ? <title>{title}</title> : null}",
  "      {glyph.body(uid)}",
  "    </svg>",
  "  );",
  "}",
  "",
];
writeFileSync(target, lines.join("\n"));
console.log(`${entries.length} icônes écrites dans ${target}`);
