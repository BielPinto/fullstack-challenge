import { Inject, Injectable } from "@nestjs/common";
import { RoundPhase } from "@prisma/client";
import {
  ROUND_REPOSITORY,
  type RoundRecord,
  type RoundRepositoryPort,
} from "../ports/game.persistence";
import { RoundNotFoundError } from "../../domain/errors/game.errors";
import { verifyCrashOutcome } from "../../domain/services/provably-fair";

export type VerifyRoundResult = {
  roundId: string;
  commitHash: string;
  serverSecret: string | null;
  clientSeed: string;
  nonce: string;
  crashMultiplierMicro: bigint | null;
  runDurationMs: number | null;
  verified: boolean;
};

@Injectable()
export class VerifyRoundUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly rounds: RoundRepositoryPort,
  ) {}

  async execute(roundId: string): Promise<VerifyRoundResult> {
    const round = await this.rounds.findById(roundId);
    if (!round) {
      throw new RoundNotFoundError();
    }

    const discloseSecret = round.phase === RoundPhase.SETTLED;
    const serverSecret = discloseSecret ? round.serverSecret : null;

    let verified = false;
    if (
      discloseSecret &&
      round.crashMultiplierMicro !== null &&
      round.runDurationMs !== null
    ) {
      verified = verifyCrashOutcome({
        serverSecret: round.serverSecret,
        commitHash: round.commitHash,
        clientSeed: round.clientSeed,
        nonce: round.nonce,
        crashMultiplierMicro: round.crashMultiplierMicro,
        runDurationMs: round.runDurationMs,
      });
    }

    return {
      roundId: round.id,
      commitHash: round.commitHash,
      serverSecret,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      crashMultiplierMicro: round.crashMultiplierMicro,
      runDurationMs: round.runDurationMs,
      verified,
    };
  }
}
