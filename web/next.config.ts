import path from "node:path";
import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Politique de sécurité du contenu (production uniquement : le serveur de
 * développement a besoin d'`eval` pour le rechargement à chaud).
 * Scripts et styles « inline » restent autorisés car Next.js en injecte sans
 * nonce dans ce mode de rendu ; tout le reste est limité à la même origine.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // Les liens vers des sources externes ne transmettent pas l'adresse de la bibliothèque.
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProduction ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] : []),
];

const nextConfig: NextConfig = {
  // Image Docker minimale : serveur Node autonome avec ses seules dépendances.
  output: "standalone",
  poweredByHeader: false,
  // Le code du bot (../src, alias @bot) est réutilisé tel quel. Il suit la convention
  // NodeNext (imports « ./x.js » vers des fichiers .ts) que Turbopack ne sait pas
  // résoudre : le site est donc construit avec webpack, qui le permet par extensionAlias.
  webpack(config, { isServer }) {
    config.resolve.extensionAlias = { ".js": [".ts", ".js"] };
    if (isServer) {
      // serverExternalPackages ne s'applique pas aux imports venant de ../src (hors du projet) :
      // ces modules sont déclarés externes ici, chargés par Node depuis web/node_modules.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        { "better-sqlite3": "commonjs better-sqlite3", pdfkit: "commonjs pdfkit" },
      ];
    }
    // Les dépendances importées depuis ../src sont prises dans web/node_modules, pour que
    // l'image du site n'ait pas besoin des node_modules du bot à l'exécution.
    config.resolve.modules = [path.join(import.meta.dirname, "node_modules"), "node_modules"];
    // src/export.ts résout ses polices par un chemin calculé (require.resolve) quand PDF_FONTS_DIR
    // n'est pas défini ; le site le définit toujours (server/game/campaigns.ts), ce chemin n'est
    // donc jamais emprunté ici : l'avertissement « Critical dependency » est sans objet.
    config.ignoreWarnings = [...(config.ignoreWarnings ?? []), { module: /src[\\/]export\.ts$/, message: /Critical dependency/ }];
    return config;
  },
  // Modules natifs ou qui lisent leurs propres fichiers (better-sqlite3, polices AFM de pdfkit) :
  // chargés par Node à l'exécution plutôt qu'empaquetés.
  serverExternalPackages: ["better-sqlite3", "pdfkit"],
  // pdfkit charge ses polices standard (Helvetica…) par un chemin calculé : le traçage de la
  // sortie autonome ne les voit pas. On les ajoute pour les routes qui produisent des PDF.
  outputFileTracingIncludes: {
    "/api/personnages/**": ["./node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/**/*"],
    "/api/campagnes/**": ["./node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
