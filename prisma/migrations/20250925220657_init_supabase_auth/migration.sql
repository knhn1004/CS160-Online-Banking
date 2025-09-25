-- CreateEnum
CREATE TYPE "public"."RoleEnum" AS ENUM ('customer', 'bank_manager');

-- CreateEnum
CREATE TYPE "public"."AccountTypeEnum" AS ENUM ('savings', 'checkings');

-- CreateEnum
CREATE TYPE "public"."TransactionStatusEnum" AS ENUM ('approved', 'denial');

-- CreateEnum
CREATE TYPE "public"."TransactionTypeEnum" AS ENUM ('internal_transfer', 'external_transfer', 'deposit', 'withdrawal');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "role" "public"."RoleEnum" NOT NULL,
    "zip_code" INTEGER NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" SERIAL NOT NULL,
    "account_number" INTEGER,
    "routing_number" INTEGER,
    "userId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "account_type" "public"."AccountTypeEnum",
    "active" BOOLEAN,
    "balance" DOUBLE PRECISION,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transactions" (
    "id" SERIAL NOT NULL,
    "sourceAccountId" INTEGER,
    "destinationAccountId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" "public"."TransactionStatusEnum" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transaction_type" "public"."TransactionTypeEnum" NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment_rules" (
    "id" SERIAL NOT NULL,
    "sourceAccountId" INTEGER NOT NULL,
    "destinationAccountId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),

    CONSTRAINT "payment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_user_id_key" ON "public"."users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "public"."users"("auth_user_id");

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_rules" ADD CONSTRAINT "payment_rules_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_rules" ADD CONSTRAINT "payment_rules_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
