import { Module } from "@nestjs/common";
import { WALLET_GATEWAY } from "../../application/ports/wallet-gateway.port";
import { RabbitMqWalletGateway } from "./rabbitmq-wallet.gateway";

@Module({
  providers: [{ provide: WALLET_GATEWAY, useClass: RabbitMqWalletGateway }],
  exports: [WALLET_GATEWAY],
})
export class MessagingModule {}
