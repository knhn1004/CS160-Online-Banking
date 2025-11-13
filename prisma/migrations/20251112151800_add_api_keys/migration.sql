-- CreateTable
CREATE TABLE "public"."api_keys" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "internal_account_id" INTEGER NOT NULL,
    "api_key_hash" VARCHAR(255) NOT NULL,
    "key_prefix" VARCHAR(20) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_api_key_hash_key" ON "public"."api_keys"("api_key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "public"."api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_internal_account_id_idx" ON "public"."api_keys"("internal_account_id");

-- CreateIndex
CREATE INDEX "api_keys_api_key_hash_idx" ON "public"."api_keys"("api_key_hash");

-- AddForeignKey
ALTER TABLE "public"."api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."api_keys" ADD CONSTRAINT "api_keys_internal_account_id_fkey" FOREIGN KEY ("internal_account_id") REFERENCES "public"."internal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


