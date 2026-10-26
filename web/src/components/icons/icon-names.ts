import { RPG_ICONS, type RpgIconName } from "./rpg-icons";

/** Correspondance entre les identifiants du moteur de règles (SRD) et les icônes du design system. */

const ABILITY_ICONS = {
  FOR: "carac-force",
  DEX: "carac-dexterite",
  CON: "carac-constitution",
  INT: "carac-intelligence",
  SAG: "carac-sagesse",
  CHA: "carac-charisme",
} as const satisfies Record<string, RpgIconName>;

function known(name: string): RpgIconName | undefined {
  return Object.hasOwn(RPG_ICONS, name) ? (name as RpgIconName) : undefined;
}

const slug = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Identifiant de classe du moteur (« clerc », « rodeur »…). */
export const classIcon = (classId: string | undefined) => (classId ? known(`classe-${classId}`) : undefined);

/** Identifiant d'espèce du moteur (« drakeide », « nain »…). */
export const speciesIcon = (speciesId: string | undefined) => (speciesId ? known(`espece-${speciesId}`) : undefined);

/** Nom d'école tel qu'écrit dans le SRD (« Évocation », « Nécromancie »…). */
export const schoolIcon = (school: string | undefined) => (school ? known(`ecole-${slug(school)}`) : undefined);

/** Abréviation de caractéristique du moteur (FOR, DEX…). */
export const abilityIcon = (ability: string): RpgIconName | undefined =>
  Object.hasOwn(ABILITY_ICONS, ability) ? ABILITY_ICONS[ability as keyof typeof ABILITY_ICONS] : undefined;
