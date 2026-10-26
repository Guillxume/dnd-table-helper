import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as uploadRoute } from "../../src/app/api/assets/route";
import { GET as fileRoute } from "../../src/app/api/files/[assetId]/[variant]/route";
import { importAsset } from "../../src/server/assets/import-asset";
import { createAuth, getAuth } from "../../src/server/auth";
import { getDb } from "../../src/server/db";
import { makeImage, resetTestState } from "../support/fixtures";

const BASE_URL = "http://localhost:3000";
const credentials = { email: "mj@example.test", password: "un-mot-de-passe-solide", name: "MJ" };
const playerCredentials = { email: "joueur@example.test", password: "un-autre-mot-de-passe-solide", name: "Joueur" };

async function signInCookie(account: { email: string; password: string } = credentials): Promise<string> {
  const response = await getAuth().handler(
    new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email: account.email, password: account.password }),
    }),
  );
  expect(response.status).toBe(200);
  const setCookie = response.headers.getSetCookie();
  return setCookie.map((cookie) => cookie.split(";")[0]).join("; ");
}

function fileRequest(assetId: string, variant: string, cookie?: string) {
  return fileRoute(
    new Request(`${BASE_URL}/api/files/${assetId}/${variant}`, { headers: cookie ? { cookie } : {} }),
    { params: Promise.resolve({ assetId, variant }) },
  );
}

async function uploadRequest(file: File, cookie?: string) {
  const form = new FormData();
  form.set("file", file);
  return uploadRoute(
    new Request(`${BASE_URL}/api/assets`, { method: "POST", body: form, headers: cookie ? { cookie } : {} }),
  );
}

describe("contrôle d'accès", () => {
  beforeAll(() => {
    process.env.BETTER_AUTH_URL = BASE_URL;
  });

  beforeEach(async () => {
    await resetTestState();
    const auth = createAuth({ allowSignUp: true });
    await auth.api.signUpEmail({ body: credentials });
    await auth.api.signUpEmail({ body: playerCredentials });
    // Rôle par défaut : joueur. Le compte du MJ est promu, comme le fait pnpm user:create.
    await getDb().user.update({ where: { email: credentials.email }, data: { role: "admin" } });
  });

  it("un joueur connecté n'a accès ni aux fichiers ni à l'import de l'atelier", async () => {
    const result = await importAsset({ filename: "a.png", declaredType: "image/png", bytes: await makeImage() });
    if (result.status !== "created") throw new Error("import attendu");
    const cookie = await signInCookie(playerCredentials);
    expect((await fileRequest(result.asset.id, "thumbnail", cookie)).status).toBe(401);
    const png = new File([new Uint8Array(await makeImage())], "ok.png", { type: "image/png" });
    expect((await uploadRequest(png, cookie)).status).toBe(401);
  });

  it("le rôle n'est pas modifiable par le client à l'inscription", async () => {
    await createAuth({ allowSignUp: true })
      .api.signUpEmail({ body: { ...playerCredentials, email: "pirate@example.test", role: "admin" } as never })
      .catch(() => undefined);
    const user = await getDb().user.findUnique({ where: { email: "pirate@example.test" } });
    expect(user?.role ?? "player").toBe("player");
  });

  it("l'inscription publique est désactivée", async () => {
    const response = await getAuth().handler(
      new Request(`${BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({ email: "intrus@example.test", password: "un-autre-mot-de-passe", name: "X" }),
      }),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it("refuse les fichiers privés sans session, les sert avec une session", async () => {
    const result = await importAsset({ filename: "a.png", declaredType: "image/png", bytes: await makeImage() });
    if (result.status !== "created") throw new Error("import attendu");
    const assetId = result.asset.id;

    for (const variant of ["thumbnail", "preview", "original"]) {
      expect((await fileRequest(assetId, variant)).status).toBe(401);
      expect((await fileRequest(assetId, variant, "better-auth.session_token=forge")).status).toBe(401);
    }

    const cookie = await signInCookie();
    const thumbnail = await fileRequest(assetId, "thumbnail", cookie);
    expect(thumbnail.status).toBe(200);
    expect(thumbnail.headers.get("content-type")).toBe("image/webp");
    expect(thumbnail.headers.get("cache-control")).toBe("private, no-cache");
    const original = await fileRequest(assetId, "original", cookie);
    expect(original.headers.get("content-type")).toBe("image/png");
  });

  it("refuse l'import sans session et rejette un fichier non autorisé avec session", async () => {
    const png = new File([new Uint8Array(await makeImage())], "ok.png", { type: "image/png" });
    expect((await uploadRequest(png)).status).toBe(401);

    const cookie = await signInCookie();
    const accepted = await uploadRequest(png, cookie);
    expect(accepted.status).toBe(201);

    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], "x.svg", {
      type: "image/svg+xml",
    });
    const rejected = await uploadRequest(svg, cookie);
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toMatchObject({ status: "rejected" });
  });
});
