import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/server/session";
import { currentTheme } from "@/server/theme";

/**
 * Toutes les pages de ce groupe exigent une session. Ce contrôle protège le
 * rendu du cadre ; chaque page et chaque action revérifient la session, car un
 * layout n'est pas réexécuté à chaque navigation.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <AppShell email={user.email} theme={await currentTheme()}>
      {children}
    </AppShell>
  );
}
