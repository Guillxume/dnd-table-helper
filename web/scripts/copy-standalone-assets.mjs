// La sortie « standalone » de Next n'embarque ni /public, ni les fichiers statiques compilés,
// ni les polices des PDF du bot (assets/pdf-fonts) : on les copie à côté de server.js après chaque build.
import { cpSync, existsSync } from "node:fs";

if (existsSync(".next/standalone")) {
  cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
  cpSync("public", ".next/standalone/public", { recursive: true });
  cpSync("assets/pdf-fonts", ".next/standalone/assets/pdf-fonts", { recursive: true });
}
