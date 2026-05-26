import {
  Controller,
  Get,
  Post,
  UseGuards,
  ConflictException,
} from "@nestjs/common";
import { WalletAlreadyExistsError } from "../../domain/errors/wallet.errors";
import { CreateWalletForUserUseCase } from "../../application/use-cases/create-wallet-for-user.use-case";
import { GetMyWalletUseCase } from "../../application/use-cases/get-my-wallet.use-case";
import { JwtAuthGuard } from "../../infrastructure/auth/jwt-auth.guard";
import { CurrentUser } from "../decorators/current-user.decorator";
import type { JwtPayload } from "../../infrastructure/auth/jwt.strategy";
import { HealthCheckResponseDto } from "../dtos/health-check-response.dto";
import { WalletResponseDto } from "../dtos/wallet-response.dto";

@Controller()
export class WalletsController {
  constructor(
    private readonly createWallet: CreateWalletForUserUseCase,
    private readonly getMyWallet: GetMyWalletUseCase,
  ) {}

  @Get("health")
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "wallets" };
  }

  /** Kong strips `/wallets` → `POST /`; direct access uses `POST /wallets`. */
  @Post(["wallets", ""])
  @UseGuards(JwtAuthGuard)
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

  /** Kong strips `/wallets` → `GET /me`; direct access uses `GET /wallets/me`. */
  @Get(["wallets/me", "me"])
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload): Promise<WalletResponseDto> {
    const wallet = await this.getMyWallet.execute(user.sub);
    return WalletResponseDto.fromWallet(wallet);
  }
}
