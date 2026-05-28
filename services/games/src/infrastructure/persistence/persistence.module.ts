import { Global, Module } from "@nestjs/common";
import {
  BET_REPOSITORY,
  ROUND_REPOSITORY,
} from "../../application/ports/game.persistence";
import { PrismaBetRepository, PrismaRoundRepository } from "./prisma-game.repositories";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: ROUND_REPOSITORY, useClass: PrismaRoundRepository },
    { provide: BET_REPOSITORY, useClass: PrismaBetRepository },
  ],
  exports: [PrismaService, ROUND_REPOSITORY, BET_REPOSITORY],
})
export class PersistenceModule {}
