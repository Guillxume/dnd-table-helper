import { describe, expect, it } from "vitest";
import { parseEnv } from "@/server/env";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  S3_BUCKET: "bucket",
  S3_ACCESS_KEY_ID: "id",
  S3_SECRET_ACCESS_KEY: "secret",
  JDR_DB_PATH: "../data/jdr.sqlite",
};

describe("configuration du site", () => {
  it("traite une variable facultative laissée vide comme absente", () => {
    const env = parseEnv({ ...base, DISCORD_GUILD_ID: "", DISCORD_CLIENT_SECRET: "", ANTHROPIC_API_KEY: "" });
    expect(env.DISCORD_GUILD_ID).toBeUndefined();
    expect(env.DISCORD_CLIENT_SECRET).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.ASSISTANT_HOURLY_LIMIT).toBe(12);
  });

  it("refuse un identifiant Discord mal formé, sans afficher sa valeur", () => {
    expect(() => parseEnv({ ...base, DISCORD_GUILD_ID: "pas-un-id" })).toThrow(/DISCORD_GUILD_ID/);
    expect(() => parseEnv({ ...base, DISCORD_GUILD_ID: "pas-un-id" })).not.toThrow(/pas-un-id/);
  });
});
