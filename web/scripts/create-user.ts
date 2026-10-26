/**
 * Crée un compte (l'inscription publique est désactivée).
 *
 *   pnpm user:create --email moi@example.com --name "Prénom"
 *
 * Le mot de passe est demandé dans le terminal (saisie masquée) ou lu dans la
 * variable INITIAL_USER_PASSWORD pour un usage non interactif. Il n'est jamais
 * accepté en argument, pour ne pas finir dans l'historique du shell.
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { createAuth, MIN_PASSWORD_LENGTH } from "../src/server/auth";
import { getDb } from "../src/server/db";

function promptHidden(question: string): Promise<string> {
  const muted = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  process.stdout.write(question);
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  return new Promise((resolve) => {
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string" } },
  });
  const email = values.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Usage : pnpm user:create --email moi@example.com [--name "Prénom"]');
  }
  const name = values.name?.trim() || email.split("@")[0];

  let password = process.env.INITIAL_USER_PASSWORD;
  if (!password) {
    if (!process.stdin.isTTY) throw new Error("Pas de terminal : définissez INITIAL_USER_PASSWORD.");
    password = await promptHidden(`Mot de passe (${MIN_PASSWORD_LENGTH} caractères minimum) : `);
    const confirmation = await promptHidden("Confirmation : ");
    if (password !== confirmation) throw new Error("Les deux saisies diffèrent.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères minimum).`);
  }

  const existing = await getDb().user.findUnique({ where: { email } });
  if (existing) throw new Error(`Un compte existe déjà pour ${email}.`);

  await createAuth({ allowSignUp: true }).api.signUpEmail({ body: { email, name, password } });
  // Les comptes créés ici sont ceux du MJ : accès complet.
  await getDb().user.update({ where: { email }, data: { role: "admin" } });
  console.log(`Compte MJ créé : ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
