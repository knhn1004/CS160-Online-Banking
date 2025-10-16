import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const prismaClientSingleton = () => {
  const url = process.env.DIRECT_URL as string | undefined;
  const client = url
    ? new PrismaClient({ datasourceUrl: url })
    : new PrismaClient();
  return client.$extends(withAccelerate());
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export function getPrisma() {
  return prisma;
}

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
