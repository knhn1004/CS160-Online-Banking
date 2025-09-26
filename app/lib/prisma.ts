import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

export function getPrisma() {
  const url = process.env.DIRECT_URL as string | undefined;
  const client = url
    ? new PrismaClient({ datasourceUrl: url })
    : new PrismaClient();
  return client.$extends(withAccelerate());
}
