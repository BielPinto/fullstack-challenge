-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance_in_cents" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_commands" (
    "command_id" TEXT NOT NULL,
    "result_type" TEXT NOT NULL,
    "result_json" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_commands_pkey" PRIMARY KEY ("command_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");
