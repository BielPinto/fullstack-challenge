import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { CashOutBetUseCase } from "../../application/use-cases/cash-out-bet.use-case";
import { GetCurrentRoundUseCase } from "../../application/use-cases/get-current-round.use-case";
import { GetMyBetsUseCase } from "../../application/use-cases/get-my-bets.use-case";
import { GetRoundHistoryUseCase } from "../../application/use-cases/get-round-history.use-case";
import { PlaceBetUseCase } from "../../application/use-cases/place-bet.use-case";
import { VerifyRoundUseCase } from "../../application/use-cases/verify-round.use-case";
import {
  BetAmountOutOfRangeError,
  BetNotActiveError,
  BetNotFoundError,
  DuplicateBetError,
  RoundNotFoundError,
  RoundNotInBettingPhaseError,
  RoundNotRunningError,
  WalletOperationRejectedError,
  WalletOperationTimeoutError,
} from "../../domain/errors/game.errors";
import { JwtAuthGuard } from "../../infrastructure/auth/jwt-auth.guard";
import type { JwtPayload } from "../../infrastructure/auth/jwt.strategy";
import { CurrentUser } from "../decorators/current-user.decorator";
import {
  toBetActionResponse,
  toMyBetItemDto,
  type PlaceBetRequestDto,
} from "../dtos/bet.dto";
import type { HealthCheckResponseDto } from "../dtos/health-check-response.dto";
import {
  toRoundHistoryItemDto,
  toRoundViewDto,
  type VerifyRoundResponseDto,
} from "../dtos/round.dto";
import { formatMultiplierMicro } from "../mappers/format";

@Controller()
export class GamesController {
  constructor(
    private readonly getCurrentRound: GetCurrentRoundUseCase,
    private readonly getRoundHistory: GetRoundHistoryUseCase,
    private readonly verifyRound: VerifyRoundUseCase,
    private readonly getMyBets: GetMyBetsUseCase,
    private readonly placeBet: PlaceBetUseCase,
    private readonly cashOutBet: CashOutBetUseCase,
  ) {}

  @Get("health")
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "games" };
  }

  @Get(["games/rounds/current", "rounds/current"])
  async currentRound() {
    const view = await this.getCurrentRound.execute();
    return toRoundViewDto(view);
  }

  @Get(["games/rounds/history", "rounds/history"])
  async roundHistory(
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    const rounds = await this.getRoundHistory.execute(
      skip ? Number(skip) : 0,
      take ? Number(take) : 20,
    );
    return { items: rounds.map(toRoundHistoryItemDto) };
  }

  @Get(["games/rounds/:roundId/verify", "rounds/:roundId/verify"])
  async verify(@Param("roundId") roundId: string): Promise<VerifyRoundResponseDto> {
    try {
      const result = await this.verifyRound.execute(roundId);
      return {
        roundId: result.roundId,
        commitHash: result.commitHash,
        serverSecret: result.serverSecret,
        clientSeed: result.clientSeed,
        nonce: result.nonce,
        crashMultiplier: result.crashMultiplierMicro
          ? formatMultiplierMicro(result.crashMultiplierMicro)
          : null,
        runDurationMs: result.runDurationMs,
        verified: result.verified,
      };
    } catch (error) {
      if (error instanceof RoundNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Get(["games/bets/me", "bets/me"])
  @UseGuards(JwtAuthGuard)
  async myBets(
    @CurrentUser() user: JwtPayload,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    const bets = await this.getMyBets.execute(
      user.sub,
      skip ? Number(skip) : 0,
      take ? Number(take) : 20,
    );
    return { items: bets.map(toMyBetItemDto) };
  }

  @Post(["games/bet", "bet"])
  @UseGuards(JwtAuthGuard)
  async bet(@CurrentUser() user: JwtPayload, @Body() body: PlaceBetRequestDto) {
    let amountInCents: bigint;
    try {
      amountInCents = BigInt(body.amountInCents);
    } catch {
      throw new BadRequestException("amountInCents must be an integer string");
    }

    try {
      const result = await this.placeBet.execute({
        userId: user.sub,
        amountInCents,
      });
      return toBetActionResponse(result.bet);
    } catch (error) {
      this.mapBetErrors(error);
    }
  }

  @Post(["games/bet/cashout", "bet/cashout"])
  @UseGuards(JwtAuthGuard)
  async cashout(@CurrentUser() user: JwtPayload) {
    try {
      const result = await this.cashOutBet.execute({ userId: user.sub });
      return toBetActionResponse(result.bet, {
        cashoutMultiplier: result.multiplierMicro,
        payoutInCents: result.payoutInCents,
      });
    } catch (error) {
      this.mapBetErrors(error);
    }
  }

  private mapBetErrors(error: unknown): never {
    if (error instanceof RoundNotInBettingPhaseError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof RoundNotRunningError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof DuplicateBetError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof BetAmountOutOfRangeError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof BetNotFoundError) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof BetNotActiveError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof WalletOperationRejectedError) {
      if (error.reason === "insufficient_funds") {
        throw new ConflictException("Insufficient wallet balance");
      }
      throw new ConflictException(error.message);
    }
    if (error instanceof WalletOperationTimeoutError) {
      throw new ServiceUnavailableException(error.message);
    }
    throw error;
  }
}
