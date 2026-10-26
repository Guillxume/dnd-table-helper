import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { getEnv } from "./env";

/**
 * Client Prisma unique par processus. En développement, le rechargement à chaud
 * réévalue ce module : l'instance est conservée sur globalThis pour ne pas
 * ouvrir un nouveau pool de connexions à chaque modification.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({ connectionString: getEnv().DATABASE_URL });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}

/** Client accepté par les fonctions utilisables dans ou hors transaction. */
export type DbClient = PrismaClient | Prisma.TransactionClient;
