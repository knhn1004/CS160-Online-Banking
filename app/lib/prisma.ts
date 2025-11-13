import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  // Use DATABASE_URL (pooler) for queries in serverless environments
  // DIRECT_URL is only for migrations (prisma migrate, db push, etc.)
  // In Cloudflare Workers/serverless, we want to use the connection pooler
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return client;
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

// In Cloudflare Workers, globalThis persists within an isolate
// Always reuse the singleton to prevent connection pool exhaustion
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// Always set it to reuse within the same isolate (works in both dev and production)
if (!globalThis.prismaGlobal) {
  globalThis.prismaGlobal = prisma;
}

export function getPrisma() {
  return prisma;
}
