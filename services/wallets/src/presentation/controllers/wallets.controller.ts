import {
  Controller,
  Get,
  Post,
  UseGuards,
  ConflictException,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { WalletAlreadyExistsError } from "../../domain/errors/wallet.errors";
import { CreateWalletForUserUseCase } from "../../application/use-cases/create-wallet-for-user.use-case";
import { GetMyWalletUseCase } from "../../application/use-cases/get-my-wallet.use-case";
import { JwtAuthGuard } from "../../infrastructure/auth/jwt-auth.guard";
import { CurrentUser } from "../decorators/current-user.decorator";
import type { JwtPayload } from "../../infrastructure/auth/jwt.strategy";
import { HealthCheckResponseDto } from "../dtos/health-check-response.dto";
import { WalletResponseDto } from "../dtos/wallet-response.dto";

@ApiTags("wallets")
@Controller()
export class WalletsController {
  constructor(
    private readonly createWallet: CreateWalletForUserUseCase,
    private readonly getMyWallet: GetMyWalletUseCase,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Service health check" })
  @ApiOkResponse({ type: HealthCheckResponseDto })
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "wallets" };
  }

  @Post(["wallets", ""])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("jwt")
  @ApiOperation({ summary: "Create wallet for authenticated user" })
  @ApiCreatedResponse({ type: WalletResponseDto })
  @ApiConflictResponse({ description: "Wallet already exists" })
  @ApiUnauthorizedResponse()
  async create(@CurrentUser() user: JwtPayload): Promise<WalletResponseDto> {
    try {
      const wallet = await this.createWallet.execute(user.sub);
      return WalletResponseDto.fromWallet(wallet);
    } catch (error) {
      if (error instanceof WalletAlreadyExistsError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Get(["wallets/me", "me"])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("jwt")
  @ApiOperation({ summary: "Get authenticated user wallet balance" })
  @ApiOkResponse({ type: WalletResponseDto })
  @ApiUnauthorizedResponse()
  async me(@CurrentUser() user: JwtPayload): Promise<WalletResponseDto> {
    const wallet = await this.getMyWallet.execute(user.sub);
    return WalletResponseDto.fromWallet(wallet);
  }
}
