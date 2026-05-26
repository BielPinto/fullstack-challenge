import type { WalletResultEventV1 } from "@crash/contracts";

export const WALLET_EVENT_PUBLISHER = Symbol("WALLET_EVENT_PUBLISHER");

export interface WalletEventPublisher {
  publish(event: WalletResultEventV1): Promise<void>;
}
