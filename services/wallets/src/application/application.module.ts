import { Module } from "@nestjs/common";
import { PersistenceModule } from "../infrastructure/persistence/persistence.module";
import { CreateWalletForUserUseCase } from "./use-cases/create-wallet-for-user.use-case";
import { GetMyWalletUseCase } from "./use-cases/get-my-wallet.use-case";

@Module({
  imports: [PersistenceModule],
  providers: [CreateWalletForUserUseCase, GetMyWalletUseCase],
  exports: [CreateWalletForUserUseCase, GetMyWalletUseCase],
})
export class ApplicationModule {}
