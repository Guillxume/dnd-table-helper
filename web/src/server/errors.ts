import { Prisma } from "@/generated/prisma/client";

/**
 * Erreur métier dont le message est destiné à l'utilisateur.
 * Toute autre erreur est considérée comme technique : journalisée côté serveur,
 * remplacée par un message générique côté interface.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super(`${what} introuvable.`);
    this.name = "NotFoundError";
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/** Journalise une erreur technique sans exposer de secret (pas de dump de configuration ni de requête). */
export function logError(context: string, error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[${context}] ${message}`);
}
