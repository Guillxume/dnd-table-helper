import { SRC_ORIGINES_MJ } from "../sources.js";

/** Lecture indicative des alignements, d'après le référentiel d'origine fourni par le MJ (résumés, hors SRD). */
export const ALIGNMENT_TEXTS: Record<string, string> = {
  "Loyal bon": "Cherche à faire le bien en s’appuyant sur des règles, des devoirs ou des institutions.",
  "Neutre bon": "Veut aider et protéger, sans être attaché à l’ordre ou à la rébellion.",
  "Chaotique bon": "Défend la liberté et le bien, quitte à contourner les règles injustes.",
  "Loyal neutre": "Privilégie le devoir, l’ordre, la tradition ou un code cohérent.",
  Neutre: "Cherche l’équilibre ou décide au cas par cas, sans principe dominant constant.",
  "Chaotique neutre": "Privilégie l’autonomie, l’imprévisibilité et la liberté personnelle.",
  "Loyal mauvais": "Exploite les règles, les hiérarchies ou les contrats pour servir ses intérêts.",
  "Neutre mauvais": "Poursuit ses objectifs sans scrupules particuliers, sans préférence pour l’ordre ou le chaos.",
  "Chaotique mauvais": "Privilégie ses désirs et la destruction des contraintes, au mépris des autres.",
};
export const ALIGNMENT_SOURCE = SRC_ORIGINES_MJ;
