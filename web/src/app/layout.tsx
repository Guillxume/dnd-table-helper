import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Cinzel, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { currentTheme } from "@/server/theme";
import "./globals.css";

// Design system : Atkinson Hyperlegible Next pour la lecture, Cinzel pour les titres (polices variables,
// hébergées par le site). Le sous-ensemble « latin » contient les accents du français, Œ et œ.
const sans = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin"] });
const title = Cinzel({ variable: "--font-cinzel", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "La Table de l'Étoile", template: "%s · La Table de l'Étoile" },
  description: "Le site de notre table de jeu de rôle : personnages, illustrations et cartes.",
  // Application privée : jamais indexée.
  robots: { index: false, follow: false },
};

// Le schéma de couleurs (contrôles natifs) suit le thème par la propriété CSS color-scheme.
export const viewport: Viewport = {
  themeColor: "#1B140F",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Thème appliqué côté serveur : aucun flash au chargement, aucun script en ligne.
  const theme = await currentTheme();
  return (
    <html lang="fr" className={`${theme === "dark" ? "dark " : ""}${sans.variable} ${title.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="bottom-right" theme={theme} />
      </body>
    </html>
  );
}
