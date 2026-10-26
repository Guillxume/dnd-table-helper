import "server-only";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

/** Thème choisi par le visiteur (cookie), sombre par défaut. */
export async function currentTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
