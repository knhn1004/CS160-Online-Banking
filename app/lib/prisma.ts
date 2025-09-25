import { PrismaClient } from "@/app/generated/prisma/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

export function getPrisma() {
  const url = process.env.DIRECT_URL as string;
  return new PrismaClient({ datasourceUrl: url }).$extends(withAccelerate());
}


