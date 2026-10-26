// Fichier généré par scripts/build-icons.mjs à partir de design/icones : ne pas modifier à la main.
import { type ReactNode, type SVGProps, useId } from "react";
import { cn } from "@/lib/utils";

type Glyph = { fill: string; stroke: string; body: (u: string) => ReactNode };

export const RPG_ICONS = {
  "carac-charisme": { fill: "none", stroke: "currentColor", body: () => <><path d="M3 18 4.5 8 9 12.5 12 6l3 6.5L19.5 8 21 18z"/> <path d="M3 21h18"/></> },
  "carac-constitution": { fill: "none", stroke: "currentColor", body: () => <><path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/> <path d="M15 10h2.5a2.5 2.5 0 0 1 2.5 2.5v2a2.5 2.5 0 0 1-2.5 2.5H15"/> <path d="M5 8c-1-2.5 1-4.5 3-3.5C9 2.5 12 2.5 13 4.5c2-1 3 1.5 2 3.5"/> <path d="M8.5 12v5M11.5 12v5"/></> },
  "carac-dexterite": { fill: "none", stroke: "currentColor", body: () => <><circle cx="12" cy="12" r="9"/> <circle cx="12" cy="12" r="5"/> <path d="M12 12h.01M13 11l7-7M17 4h3v3"/></> },
  "carac-force": { fill: "none", stroke: "currentColor", body: () => <><path d="M7.5 12h9"/> <rect x="4.5" y="7" width="3" height="10" rx="1"/> <rect x="16.5" y="7" width="3" height="10" rx="1"/> <path d="M2 10v4M22 10v4"/></> },
  "carac-intelligence": { fill: "none", stroke: "currentColor", body: () => <><path d="M12 5v13"/> <path d="M12 5C10.5 3.5 8 3.5 6.5 5 4.5 5 3.5 7 4 9 2.5 10 2.5 12.5 4 13.5 3.5 15.5 5 17.5 7 17.5 8 19 10.5 19.5 12 18"/> <path d="M12 5C13.5 3.5 16 3.5 17.5 5 19.5 5 20.5 7 20 9 21.5 10 21.5 12.5 20 13.5 20.5 15.5 19 17.5 17 17.5 16 19 13.5 19.5 12 18"/> <path d="M8 9.5c1.5 0 2.5 1 2.5 2.5M16 9.5c-1.5 0-2.5 1-2.5 2.5"/></> },
  "carac-sagesse": { fill: "none", stroke: "currentColor", body: () => <><path d="M5 4l3 2.5h8L19 4v9c0 4.5-3 8-7 8s-7-3.5-7-8z"/> <circle cx="8.8" cy="11" r="1.8"/> <circle cx="15.2" cy="11" r="1.8"/> <path d="M12 13.5v2"/></> },
  "classe-barbare": { fill: "none", stroke: "currentColor", body: () => <><path d="M4 20 14 10"/> <path d="M10 6C13 3 19 3 21 5c1 3 1 7-3 9z"/></> },
  "classe-barde": { fill: "none", stroke: "currentColor", body: () => <><circle cx="8.5" cy="15.5" r="5"/> <path d="M12 12 20 4"/> <path d="M17.5 3.5l3 3"/> <path d="M8.5 15.5h.01"/></> },
  "classe-clerc": { fill: "none", stroke: "currentColor", body: () => <><path d="M4 20 13.5 10.5"/> <circle cx="16" cy="8" r="3.5"/> <path d="M16 4.5V2M19.5 8H22M12.5 8H10M16 11.5V14"/></> },
  "classe-druide": { fill: "none", stroke: "currentColor", body: () => <><path d="M12 3C15 3 17 5 17 7.5 19 8 20 10 20 12 20 14 18 15.5 16 15.5H8C6 15.5 4 14 4 12 4 10 5 8 7 7.5 7 5 9 3 12 3Z"/> <path d="M12 21V12.5M12 15.5l-3-3M12 14l2.5-2.5M9 21h6"/></> },
  "classe-ensorceleur": { fill: "none", stroke: "currentColor", body: () => <><path d="M10 3C10.8 8 12 9.2 17 10 12 10.8 10.8 12 10 17 9.2 12 8 10.8 3 10 8 9.2 9.2 8 10 3Z"/> <path d="M19 14l.9 2.1 2.1.9-2.1.9L19 20l-.9-2.1-2.1-.9 2.1-.9z"/> <path d="M19.5 3v4M17.5 5h4"/></> },
  "classe-guerrier": { fill: "none", stroke: "currentColor", body: () => <><path d="M4 4l10.5 10.5M12 17l5-5M14.5 14.5l5 5M20.5 20.5h.01"/> <path d="M20 4 9.5 14.5M12 17l-5-5M9.5 14.5l-5 5M3.5 20.5h.01"/></> },
  "classe-magicien": { fill: "none", stroke: "currentColor", body: () => <><path d="M12 3 7.5 17M12 3l4.5 14M8.8 13h6.4"/> <ellipse cx="12" cy="19" rx="9" ry="2"/></> },
  "classe-moine": { fill: "none", stroke: "currentColor", body: () => <><path d="M10.5 13.5a1.5 1.5 0 0 1 3 0 4.5 4.5 0 0 1-9 0 7.5 7.5 0 0 1 15 0"/></> },
  "classe-occultiste": { fill: "none", stroke: "currentColor", body: () => <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/> <ellipse cx="12" cy="12" rx="1.4" ry="3.2"/></> },
  "classe-paladin": { fill: "none", stroke: "currentColor", body: () => <><path d="M12 2.5 20 5.5V12c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5.5z"/> <path d="M12 7v9M8.5 10.5h7"/></> },
  "classe-rodeur": { fill: "none", stroke: "currentColor", body: () => <><path d="M9 3c8 4 8 14 0 18"/> <path d="M9 3v18M3 12h18"/> <path d="M17.5 8.5 21 12l-3.5 3.5M3 12l2.5-2.5M3 12l2.5 2.5"/></> },
  "classe-roublard": { fill: "none", stroke: "currentColor", body: () => <><path d="M3 9c0-2.5 2-4 5-3l4 1.2L16 6c3-1 5 .5 5 3 0 5-2 8-5 8-2 0-3-2.5-4-2.5-1 0-2 2.5-4 2.5-3 0-5-3-5-8z"/> <path d="M8 10.5h.01M16 10.5h.01"/></> },
  "ecole-abjuration": { fill: "none", stroke: "currentColor", body: () => <><path d="M3 18C3 11 7 5 12 5s9 6 9 13"/> <path d="M2 18h20"/> <path d="M7 18c0-4 2-7 5-7s5 3 5 7"/></> },
  "ecole-divination": { fill: "none", stroke: "currentColor", body: () => <><circle cx="12" cy="9.5" r="6.5"/> <path d="M7 21h10M8.8 14.8 7.5 21M15.2 14.8 16.5 21"/> <path d="M9 8c.5-1.2 1.4-2 2.6-2.3"/></> },
  "ecole-enchantement": { fill: "none", stroke: "currentColor", body: () => <><path d="M12 20.5C5 15 3 12 3 8.5 3 5.5 5.2 3.5 7.8 3.5 9.6 3.5 11.2 4.5 12 6 12.8 4.5 14.4 3.5 16.2 3.5 18.8 3.5 21 5.5 21 8.5 21 12 19 15 12 20.5Z"/></> },
  "ecole-evocation": { fill: "none", stroke: "currentColor", body: () => <><path d="M12 2.5c.5 4 5.5 6 5.5 11.5 0 4-2.5 7-5.5 7-3 0-5.5-3-5.5-7 0-2.5 1.2-4 2.2-5.4.4 1.8 1.2 2.7 2 3 .6-3-.5-5.5 1.3-9.1z"/> <path d="M12 20.5c-1.5 0-2.5-1.5-2.5-3.2 0-1.6 1.5-2.6 2.5-4.3 1 1.7 2.5 2.7 2.5 4.3 0 1.7-1 3.2-2.5 3.2z"/></> },
  "ecole-illusion": { fill: "none", stroke: "currentColor", body: () => <><circle cx="9.5" cy="12" r="6"/> <circle cx="14.5" cy="12" r="6" strokeDasharray="0.1 3.8"/></> },
  "ecole-invocation": { fill: "none", stroke: "currentColor", body: () => <><circle cx="12" cy="12" r="9"/> <path d="M12 5l6.06 10.5H5.94z"/> <path d="M12 12h.01"/></> },
  "ecole-necromancie": { fill: "none", stroke: "currentColor", body: () => <><path d="M12 3C7.5 3 4.5 6 4.5 10c0 2.5 1 4 2.5 5v4h10v-4c1.5-1 2.5-2.5 2.5-5 0-4-3-7-7.5-7z"/> <circle cx="9" cy="10.5" r="1.3"/> <circle cx="15" cy="10.5" r="1.3"/> <path d="M10 19v-2.2M12 19v-2.2M14 19v-2.2"/></> },
  "ecole-transmutation": { fill: "none", stroke: "currentColor", body: () => <><path d="M4 12a8 8 0 0 1 14.5-4.5"/> <path d="M19 3.5V8h-4.5"/> <path d="M20 12a8 8 0 0 1-14.5 4.5"/> <path d="M5 20.5V16h4.5"/></> },
  "espece-aasimar": { fill: "none", stroke: "currentColor", body: () => <><ellipse cx="12" cy="4.5" rx="4.5" ry="1.6"/> <circle cx="12" cy="11.5" r="3.5"/> <path d="M5 21.5c0-3 3-5 7-5 4 0 7 2 7 5"/></> },
  "espece-drakeide": { fill: "none", stroke: "currentColor", body: () => <><path d="M12 7.5 15 6l1.5.5C18 4.5 19.5 3.5 21.5 3 21 5 20.5 7 19 8.5L21 12l-3.5 1L16 18l-2.5 2.5L12 21l-1.5-.5L8 18l-1.5-5L3 12l2-3.5C3.5 7 3 5 2.5 3 4.5 3.5 6 4.5 7.5 6.5L9 6z"/> <path d="M9 11l2 1.2M15 11l-2 1.2M11 16.5h.01M13 16.5h.01"/></> },
  "espece-elfe": { fill: "none", stroke: "currentColor", body: () => <><circle cx="12" cy="13" r="5"/> <path d="M7.2 11.2 2 7l5.8 8"/> <path d="M16.8 11.2 22 7l-5.8 8"/> <path d="M10 12.5h.01M14 12.5h.01M10.5 15.3c.9.6 2.1.6 3 0"/></> },
  "espece-gnome": { fill: "none", stroke: "currentColor", body: () => <><path d="M6.5 10.5C7 6 9.5 3.5 14.5 2 14.5 5.5 16 8 17.5 10.5"/> <path d="M5 10.5h14"/> <path d="M7.5 10.5V13c0 4 2 7 4.5 8 2.5-1 4.5-4 4.5-8v-2.5"/> <path d="M10 13.5h.01M14 13.5h.01"/> <circle cx="12" cy="16.3" r="1.2"/></> },
  "espece-goliath": { fill: "none", stroke: "currentColor", body: () => <><path d="M2.5 20 9 8.5l3.5 5.5 3-4.5 6 10.5z"/> <path d="M7.2 11.8 9 13.5l1.8-1.7"/></> },
  "espece-halfelin": { fill: "none", stroke: "currentColor", body: () => <><ellipse cx="12" cy="16.5" rx="4" ry="5"/> <path d="M7.5 10.5h.01M10 8h.01M13.8 8h.01M16.3 10.5h.01" strokeWidth="3.2"/></> },
  "espece-humain": { fill: "none", stroke: "currentColor", body: () => <><circle cx="12" cy="8" r="4"/> <path d="M4 21v-1.5a4.5 4.5 0 0 1 4.5-4.5h7a4.5 4.5 0 0 1 4.5 4.5V21"/></> },
  "espece-nain": { fill: "none", stroke: "currentColor", body: () => <><path d="M7 10C7 6 9 4 12 4s5 2 5 6"/> <path d="M6 10h12"/> <path d="M7 10v4c0 4 2 7 5 8 3-1 5-4 5-8v-4"/> <path d="M9.5 14.5c1-1.2 2-1.2 2.5 0 .5-1.2 1.5-1.2 2.5 0"/> <path d="M10 12.5h.01M14 12.5h.01"/></> },
  "espece-orc": { fill: "none", stroke: "currentColor", body: () => <><path d="M6 8C6 5.5 8.5 4 12 4s6 1.5 6 4v5c0 4-2.5 7-6 7s-6-3-6-7z"/> <path d="M8.5 9.5l2 1M15.5 9.5l-2 1"/> <path d="M9.5 12h.01M14.5 12h.01"/> <path d="M9.2 17.2 8.4 13.2M14.8 17.2 15.6 13.2"/></> },
  "espece-tieffelin": { fill: "none", stroke: "currentColor", body: () => <><circle cx="12" cy="14" r="5"/> <path d="M8.5 10C5 9 3.5 6 4.5 3M15.5 10C19 9 20.5 6 19.5 3"/> <path d="M10 13.5h.01M14 13.5h.01M10.5 16.2c.9.6 2.1.6 3 0"/></> },
  "identite-d20-contour": { fill: "none", stroke: "currentColor", body: () => <><path d="M12 2.2l8.5 4.9v9.8L12 21.8l-8.5-4.9V7.1z"/> <path d="M12 7l-4.2 7.2h8.4z"/> <path d="M12 2.2V7M7.8 14.2l-4.3 2.7M16.2 14.2l4.3 2.7"/></> },
  "identite-d20-plein": { fill: "none", stroke: "currentColor", body: (u) => <><mask id={`${u}m-d20-plein`}> <rect width="24" height="24" fill="#fff"/> <path d="M12 7l-4.2 7.2h8.4zM12 2.2V7M7.8 14.2l-4.3 2.7M16.2 14.2l4.3 2.7" stroke="#000" strokeWidth="1.6"/> </mask> <path d="M12 2.2l8.5 4.9v9.8L12 21.8l-8.5-4.9V7.1z" fill="currentColor" mask={`url(#${u}m-d20-plein)`}/></> },
  "identite-dragon-contour": { fill: "none", stroke: "currentColor", body: () => <><path d="M4.5 21C4.5 16 5.5 12.5 7.5 10L2.5 4.5 10 7C13 5.5 17 6.5 19.5 9L21.5 10V12L13.5 13 20 15.5 12.5 17.5C11.5 19 10.5 20 10 21Z"/> <path d="M14 9.5h.01"/></> },
  "identite-dragon-plein": { fill: "none", stroke: "currentColor", body: (u) => <><mask id={`${u}m-dragon-plein`}> <rect width="24" height="24" fill="#fff"/> <path d="M14 9.5h.01" stroke="#000" strokeWidth="3"/> </mask> <path d="M4.5 21C4.5 16 5.5 12.5 7.5 10L2.5 4.5 10 7C13 5.5 17 6.5 19.5 9L21.5 10V12L13.5 13 20 15.5 12.5 17.5C11.5 19 10.5 20 10 21Z" fill="currentColor" mask={`url(#${u}m-dragon-plein)`}/></> },
  "nav-bibliotheque-images": { fill: "none", stroke: "currentColor", body: () => <><path d="M6 3.5h13.5a2 2 0 0 1 2 2V17"/> <rect x="3" y="7" width="16" height="14" rx="2"/> <circle cx="8" cy="11.5" r="1.3"/> <path d="M3 18.5l4.5-4 3.5 3 3-3 5 5"/></> },
  "nav-campagne": { fill: "none", stroke: "currentColor", body: () => <><path d="M3 21V5h2v2h2V5h1v5h8V5h1v2h2V5h2v16z"/> <path d="M10 21v-4a2 2 0 0 1 4 0v4"/> <path d="M5.5 12v2M18.5 12v2"/></> },
  "nav-carte-bataille": { fill: "none", stroke: "currentColor", body: () => <><rect x="3" y="3" width="18" height="18" rx="2"/> <path d="M9 3v18M15 3v18M3 9h18M3 15h18"/> <circle cx="12" cy="12" r="1.8" fill="currentColor"/></> },
  "nav-creation": { fill: "none", stroke: "currentColor", body: () => <><path d="M20 4C14 4 9 7 7 13l-2 5.5L4 20l1.5-1 5.5-2c6-2 9-7 9-13z"/> <path d="M4 20 13 11"/> <path d="M5 5v4M3 7h4"/></> },
  "nav-des": { fill: "none", stroke: "currentColor", body: () => <><rect x="3.5" y="3.5" width="17" height="17" rx="3"/> <path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" strokeWidth="3"/></> },
  "nav-equipement": { fill: "none", stroke: "currentColor", body: () => <><path d="M6 21V11a6 6 0 0 1 12 0v10z"/> <path d="M9.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5"/> <path d="M6 14h12M9.5 17.5h5"/></> },
  "nav-fiche": { fill: "none", stroke: "currentColor", body: () => <><path d="M19 17V5a2 2 0 0 0-2-2H4"/> <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/></> },
  "nav-pdf-telecharger": { fill: "none", stroke: "currentColor", body: () => <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/> <path d="M14 3v5h5"/> <path d="M12 11v6M9.5 14.5 12 17l2.5-2.5"/></> },
  "nav-personnages": { fill: "none", stroke: "currentColor", body: () => <><circle cx="9" cy="8" r="3.5"/> <path d="M2.5 20v-1a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v1"/> <path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.7a4.5 4.5 0 0 1 3 4.3v1"/></> },
  "nav-publier-discord": { fill: "none", stroke: "currentColor", body: () => <><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/> <path d="M12 14V8M9.5 10.5 12 8l2.5 2.5"/></> },
  "nav-seance": { fill: "none", stroke: "currentColor", body: () => <><rect x="3" y="4.5" width="18" height="16.5" rx="2"/> <path d="M8 2.5v4M16 2.5v4M3 10h18"/> <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" strokeWidth="2.6"/></> },
  "nav-sorts": { fill: "none", stroke: "currentColor", body: () => <><path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1z"/> <path d="M9 3v18"/> <path d="M14.5 7.5l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9z"/></> },
} satisfies Record<string, Glyph>;

export type RpgIconName = keyof typeof RPG_ICONS;

/** Icône du design system (24 × 24, couleur du texte). Décorative par défaut ; donner `title` si elle porte un sens seule. */
export function RpgIcon({ name, title, className, ...props }: { name: RpgIconName; title?: string } & SVGProps<SVGSVGElement>) {
  const glyph: Glyph = RPG_ICONS[name];
  // Caractères de useId retirés : l'identifiant sert dans url(#…).
  const uid = `i${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={glyph.fill}
      stroke={glyph.stroke}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
      className={cn("size-6 shrink-0", className)}
    >
      {title ? <title>{title}</title> : null}
      {glyph.body(uid)}
    </svg>
  );
}
