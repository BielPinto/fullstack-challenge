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
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CashOutBetUseCase } from "../../application/use-cases/cash-out-bet.use-case";
import { GetCurrentRoundUseCase } from "../../application/use-cases/get-current-round.use-case";
import { GetLeaderboardUseCase } from "../../application/use-cases/get-leaderboard.use-case";
import { GetMyBetsUseCase } from "../../application/use-cases/get-my-bets.use-case";
import { GetRoundHistoryUseCase } from "../../application/use-cases/get-round-history.use-case";
import { PlaceBetUseCase } from "../../application/use-cases/place-bet.use-case";
import { VerifyRoundUseCase } from "../../application/use-cases/verify-round.use-case";
import {
  assertAutoCashoutMultiplierInRange,
  parseMultiplierStringToMicro,
} from "../../domain/value-objects/auto-cashout";
import {
  AutoCashoutMultiplierOutOfRangeError,
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
  BetActionResponseDto,
  MyBetsResponseDto,
  PlaceBetRequestDto,
  toBetActionResponse,
  toMyBetItemDto,
} from "../dtos/bet.dto";
import { HealthCheckResponseDto } from "../dtos/health-check-response.dto";
import {
  LeaderboardResponseDto,
  toLeaderboardResponse,
} from "../dtos/leaderboard.dto";
import {
  RoundHistoryResponseDto,
  RoundViewDto,
  toRoundHistoryItemDto,
  toRoundViewDto,
  VerifyRoundResponseDto,
} from "../dtos/round.dto";
import { formatMultiplierMicro } from "../mappers/format";

@ApiTags("games")
@Controller()
export class GamesController {
  constructor(
    private readonly getCurrentRound: GetCurrentRoundUseCase,
    private readonly getRoundHistory: GetRoundHistoryUseCase,
    private readonly verifyRound: VerifyRoundUseCase,
    private readonly getMyBets: GetMyBetsUseCase,
    private readonly placeBet: PlaceBetUseCase,
    private readonly cashOutBet: CashOutBetUseCase,
    private readonly getLeaderboard: GetLeaderboardUseCase,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Service health check" })
  @ApiOkResponse({ type: HealthCheckResponseDto })
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "games" };
  }

  @Get(["games/rounds/current", "rounds/current"])
  @ApiOperation({ summary: "Current round snapshot (phase, multiplier, public bets)" })
  @ApiOkResponse({ type: RoundViewDto })
  async currentRound(): Promise<RoundViewDto> {
    const view = await this.getCurrentRound.execute();
    return toRoundViewDto(view);
  }

  @Get(["games/rounds/history", "rounds/history"])
  @ApiOperation({ summary: "Settled rounds history" })
  @ApiQuery({ name: "skip", required: false, type: Number })
  @ApiQuery({ name: "take", required: false, type: Number })
  @ApiOkResponse({ type: RoundHistoryResponseDto })
  async roundHistory(
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ): Promise<RoundHistoryResponseDto> {
    const rounds = await this.getRoundHistory.execute(
      skip ? Number(skip) : 0,
      take ? Number(take) : 20,
    );
    return { items: rounds.map(toRoundHistoryItemDto) };
  }

  @Get(["games/rounds/:roundId/verify", "rounds/:roundId/verify"])
  @ApiOperation({ summary: "Provably fair verification data for a round" })
  @ApiOkResponse({ type: VerifyRoundResponseDto })
  @ApiNotFoundResponse({ description: "Round not found" })
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

  @Get(["games/leaderboard", "leaderboard"])
  @ApiOperation({ summary: "Top players by net profit (24h or 7d)" })
  @ApiQuery({ name: "period", required: false, enum: ["24h", "7d"] })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiOkResponse({ type: LeaderboardResponseDto })
  async leaderboard(
    @Query("period") period?: string,
    @Query("limit") limit?: string,
  ): Promise<LeaderboardResponseDto> {
    const resolvedPeriod = period === "7d" ? "7d" : "24h";
    const result = await this.getLeaderboard.execute({
      period: resolvedPeriod,
      limit: limit ? Number(limit) : 10,
    });
    return toLeaderboardResponse(result.period, result.items);
  }

  @Get(["games/bets/me", "bets/me"])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("jwt")
  @ApiOperation({ summary: "Authenticated player bet history" })
  @ApiQuery({ name: "skip", required: false, type: Number })
  @ApiQuery({ name: "take", required: false, type: Number })
  @ApiOkResponse({ type: MyBetsResponseDto })
  @ApiUnauthorizedResponse()
  async myBets(
    @CurrentUser() user: JwtPayload,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ): Promise<MyBetsResponseDto> {
    const bets = await this.getMyBets.execute(
      user.sub,
      skip ? Number(skip) : 0,
      take ? Number(take) : 20,
    );
    return { items: bets.map(toMyBetItemDto) };
  }

  @Post(["games/bet", "bet"])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("jwt")
  @ApiOperation({ summary: "Place a bet on the current round (betting phase only)" })
  @ApiCreatedResponse({ type: BetActionResponseDto })
  @ApiConflictResponse({ description: "Insufficient balance, duplicate bet, or wrong phase" })
  @ApiUnauthorizedResponse()
  @ApiServiceUnavailableResponse({ description: "Wallet operation timeout" })
  async bet(
    @CurrentUser() user: JwtPayload,
    @Body() body: PlaceBetRequestDto,
  ): Promise<BetActionResponseDto> {
    let amountInCents: bigint;
    try {
      amountInCents = BigInt(body.amountInCents);
    } catch {
      throw new BadRequestException("amountInCents must be an integer string");
    }

    let autoCashoutMultiplierMicro: bigint | null = null;
    if (body.autoCashoutMultiplier?.trim()) {
      const parsed = parseMultiplierStringToMicro(body.autoCashoutMultiplier);
      if (!parsed) {
        throw new BadRequestException(
          "autoCashoutMultiplier must be a decimal like 2.00",
        );
      }
      try {
        assertAutoCashoutMultiplierInRange(parsed);
      } catch (error) {
        if (error instanceof AutoCashoutMultiplierOutOfRangeError) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }
      autoCashoutMultiplierMicro = parsed;
    }

    try {
      const result = await this.placeBet.execute({
        userId: user.sub,
        amountInCents,
        autoCashoutMultiplierMicro,
      });
      return toBetActionResponse(result.bet);
    } catch (error) {
      this.mapBetErrors(error);
    }
  }

  @Post(["games/bet/cashout", "bet/cashout"])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("jwt")
  @ApiOperation({ summary: "Cash out active bet during running phase" })
  @ApiCreatedResponse({ type: BetActionResponseDto })
  @ApiConflictResponse({ description: "No active bet or round not running" })
  @ApiNotFoundResponse({ description: "Bet not found" })
  @ApiUnauthorizedResponse()
  async cashout(@CurrentUser() user: JwtPayload): Promise<BetActionResponseDto> {
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
