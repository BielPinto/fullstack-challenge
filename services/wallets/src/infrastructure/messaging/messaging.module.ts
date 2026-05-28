import { Module } from "@nestjs/common";
import { WALLET_EVENT_PUBLISHER } from "../../application/ports/wallet-event.publisher";
import { ProcessWalletCommandHandler } from "../../application/handlers/process-wallet-command.handler";
import { PersistenceModule } from "../persistence/persistence.module";
import { RabbitMqWalletCommandConsumer } from "./rabbitmq-wallet-command.consumer";
import { RabbitMqWalletEventPublisher } from "./rabbitmq-wallet-event.publisher";

@Module({
  imports: [PersistenceModule],
  providers: [
    ProcessWalletCommandHandler,
    RabbitMqWalletEventPublisher,
    RabbitMqWalletCommandConsumer,
    { provide: WALLET_EVENT_PUBLISHER, useExisting: RabbitMqWalletEventPublisher },
  ],
})
export class MessagingModule {}
