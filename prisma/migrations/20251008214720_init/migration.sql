-- CreateEnum
CREATE TYPE "public"."RoleEnum" AS ENUM ('customer', 'bank_manager');

-- CreateEnum
CREATE TYPE "public"."USStateTerritory" AS ENUM ('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'PR', 'GU', 'VI', 'AS', 'MP');

-- CreateEnum
CREATE TYPE "public"."AccountTypeEnum" AS ENUM ('savings', 'checking');

-- CreateEnum
CREATE TYPE "public"."TransactionStatusEnum" AS ENUM ('pending', 'approved', 'denied');

-- CreateEnum
CREATE TYPE "public"."TransactionTypeEnum" AS ENUM ('internal_transfer', 'external_transfer', 'billpay', 'deposit', 'withdrawal');

-- CreateEnum
CREATE TYPE "public"."PaymentDirection" AS ENUM ('outbound', 'inbound');

-- CreateEnum
CREATE TYPE "public"."TransferKind" AS ENUM ('recurring', 'one_off');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone_number" VARCHAR(12) NOT NULL,
    "street_address" TEXT NOT NULL,
    "address_line_2" TEXT,
    "city" TEXT NOT NULL,
    "state_or_territory" "public"."USStateTerritory" NOT NULL,
    "postal_code" VARCHAR(10) NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'United States',
    "role" "public"."RoleEnum" NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."internal_accounts" (
    "id" SERIAL NOT NULL,
    "account_number" VARCHAR(17) NOT NULL,
    "routing_number" CHAR(9) NOT NULL DEFAULT '724722907',
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "account_type" "public"."AccountTypeEnum" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "balance" DECIMAL(19,4) NOT NULL DEFAULT 0,

    CONSTRAINT "internal_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."external_accounts" (
    "id" SERIAL NOT NULL,
    "nickname" VARCHAR(30),
    "user_id" INTEGER NOT NULL,
    "account_number" VARCHAR(17) NOT NULL,
    "routing_number" CHAR(9) NOT NULL,

    CONSTRAINT "external_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transactions" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "status" "public"."TransactionStatusEnum" NOT NULL,
    "transaction_type" "public"."TransactionTypeEnum" NOT NULL,
    "check_number" VARCHAR(12),
    "internal_account_id" INTEGER NOT NULL,
    "external_routing_number" CHAR(9),
    "external_account_number" VARCHAR(17),
    "external_nickname" VARCHAR(30),
    "direction" "public"."PaymentDirection" NOT NULL,
    "transfer_rule_id" INTEGER,
    "bill_pay_rule_id" INTEGER,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transfer_rules" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "transfer_kind" "public"."TransferKind" NOT NULL DEFAULT 'recurring',
    "direction" "public"."PaymentDirection" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "frequency" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "run_at" TIMESTAMP(3),
    "source_internal_id" INTEGER NOT NULL,
    "destination_internal_id" INTEGER,
    "destination_external_id" INTEGER,
    "external_routing_number" CHAR(9),
    "external_account_number" VARCHAR(17),

    CONSTRAINT "transfer_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billpay_rules" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "source_internal_id" INTEGER NOT NULL,
    "payee_id" INTEGER NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "frequency" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),

    CONSTRAINT "billpay_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billpay_payees" (
    "id" SERIAL NOT NULL,
    "business_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "street_address" TEXT NOT NULL,
    "address_line_2" TEXT,
    "city" TEXT NOT NULL,
    "state_or_territory" "public"."USStateTerritory" NOT NULL,
    "postal_code" VARCHAR(10) NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'United States',
    "account_number" VARCHAR(17) NOT NULL,
    "routing_number" CHAR(9) NOT NULL,

    CONSTRAINT "billpay_payees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "public"."users"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "public"."users"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "internal_accounts_account_number_key" ON "public"."internal_accounts"("account_number");

-- CreateIndex
CREATE INDEX "internal_accounts_user_id_idx" ON "public"."internal_accounts"("user_id");

-- CreateIndex
CREATE INDEX "external_accounts_user_id_idx" ON "public"."external_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_accounts_user_id_routing_number_account_number_key" ON "public"."external_accounts"("user_id", "routing_number", "account_number");

-- CreateIndex
CREATE INDEX "transactions_internal_account_id_idx" ON "public"."transactions"("internal_account_id");

-- CreateIndex
CREATE INDEX "transactions_transfer_rule_id_idx" ON "public"."transactions"("transfer_rule_id");

-- CreateIndex
CREATE INDEX "transactions_bill_pay_rule_id_idx" ON "public"."transactions"("bill_pay_rule_id");

-- CreateIndex
CREATE INDEX "transactions_internal_account_id_created_at_idx" ON "public"."transactions"("internal_account_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_status_created_at_idx" ON "public"."transactions"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_status_transaction_type_idx" ON "public"."transactions"("status", "transaction_type");

-- CreateIndex
CREATE INDEX "transfer_rules_user_id_idx" ON "public"."transfer_rules"("user_id");

-- CreateIndex
CREATE INDEX "transfer_rules_source_internal_id_idx" ON "public"."transfer_rules"("source_internal_id");

-- CreateIndex
CREATE INDEX "transfer_rules_destination_internal_id_idx" ON "public"."transfer_rules"("destination_internal_id");

-- CreateIndex
CREATE INDEX "transfer_rules_destination_external_id_idx" ON "public"."transfer_rules"("destination_external_id");

-- CreateIndex
CREATE INDEX "billpay_rules_user_id_idx" ON "public"."billpay_rules"("user_id");

-- CreateIndex
CREATE INDEX "billpay_rules_source_internal_id_idx" ON "public"."billpay_rules"("source_internal_id");

-- CreateIndex
CREATE INDEX "billpay_rules_payee_id_idx" ON "public"."billpay_rules"("payee_id");

-- CreateIndex
CREATE INDEX "billpay_payees_business_name_idx" ON "public"."billpay_payees"("business_name");

-- AddForeignKey
ALTER TABLE "public"."internal_accounts" ADD CONSTRAINT "internal_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."external_accounts" ADD CONSTRAINT "external_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_internal_account_id_fkey" FOREIGN KEY ("internal_account_id") REFERENCES "public"."internal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_transfer_rule_id_fkey" FOREIGN KEY ("transfer_rule_id") REFERENCES "public"."transfer_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_bill_pay_rule_id_fkey" FOREIGN KEY ("bill_pay_rule_id") REFERENCES "public"."billpay_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_rules" ADD CONSTRAINT "transfer_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_rules" ADD CONSTRAINT "transfer_rules_source_internal_id_fkey" FOREIGN KEY ("source_internal_id") REFERENCES "public"."internal_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_rules" ADD CONSTRAINT "transfer_rules_destination_internal_id_fkey" FOREIGN KEY ("destination_internal_id") REFERENCES "public"."internal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_rules" ADD CONSTRAINT "transfer_rules_destination_external_id_fkey" FOREIGN KEY ("destination_external_id") REFERENCES "public"."external_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billpay_rules" ADD CONSTRAINT "billpay_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billpay_rules" ADD CONSTRAINT "billpay_rules_source_internal_id_fkey" FOREIGN KEY ("source_internal_id") REFERENCES "public"."internal_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billpay_rules" ADD CONSTRAINT "billpay_rules_payee_id_fkey" FOREIGN KEY ("payee_id") REFERENCES "public"."billpay_payees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
