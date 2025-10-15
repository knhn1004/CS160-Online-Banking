/*
  Warnings:

  - The values [pending] on the enum `TransactionStatusEnum` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[idempotency_key]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."TransactionStatusEnum_new" AS ENUM ('approved', 'denied');
ALTER TABLE "public"."transactions" ALTER COLUMN "status" TYPE "public"."TransactionStatusEnum_new" USING ("status"::text::"public"."TransactionStatusEnum_new");
ALTER TYPE "public"."TransactionStatusEnum" RENAME TO "TransactionStatusEnum_old";
ALTER TYPE "public"."TransactionStatusEnum_new" RENAME TO "TransactionStatusEnum";
DROP TYPE "public"."TransactionStatusEnum_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."transactions" ADD COLUMN     "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "public"."transactions"("idempotency_key");
