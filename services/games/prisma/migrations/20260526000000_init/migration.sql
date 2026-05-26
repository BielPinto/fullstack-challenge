-- CreateEnum
CREATE TYPE "RoundPhase" AS ENUM ('BETTING', 'RUNNING', 'SETTLED');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('DEBIT_PENDING', 'ACTIVE', 'CASHED_OUT', 'LOST', 'DEBIT_FAILED');

-- CreateTable
CREATE TABLE "rounds" (
    "id" UUID NOT NULL,
    "phase" "RoundPhase" NOT NULL,
    "commit_hash" TEXT NOT NULL,
    "server_secret" TEXT NOT NULL,
    "client_seed" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "crash_multiplier_micro" BIGINT,
    "run_duration_ms" INTEGER,
    "betting_ends_at" TIMESTAMP(3) NOT NULL,
    "running_started_at" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_in_cents" BIGINT NOT NULL,
    "status" "BetStatus" NOT NULL,
    "cashout_multiplier_micro" BIGINT,
    "payout_in_cents" BIGINT,
    "debit_command_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bets_debit_command_id_key" ON "bets"("debit_command_id");

-- CreateIndex
CREATE UNIQUE INDEX "bets_round_id_user_id_key" ON "bets"("round_id", "user_id");

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
