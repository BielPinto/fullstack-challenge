import { describe, expect, it } from "bun:test";
import {
  AMQP_EXCHANGES,
  WALLET_COMMAND_ROUTING_KEYS,
  WALLET_EVENT_ROUTING_KEYS,
} from "../../src/amqp-topology";

describe("AMQP topology", () => {
  it("defines durable topic exchanges for wallet integration", () => {
    expect(AMQP_EXCHANGES.walletCommands).toBe("wallet.commands");
    expect(AMQP_EXCHANGES.walletEvents).toBe("wallet.events");
  });

  it("versions command routing keys", () => {
    expect(WALLET_COMMAND_ROUTING_KEYS.debitRequestV1).toMatch(/\.v1$/);
    expect(WALLET_COMMAND_ROUTING_KEYS.creditRequestV1).toMatch(/\.v1$/);
  });

  it("versions event routing keys for all wallet outcomes", () => {
    const keys = Object.values(WALLET_EVENT_ROUTING_KEYS);
    expect(keys).toHaveLength(4);
    for (const key of keys) {
      expect(key).toMatch(/^wallet\.(debit|credit)\.(succeeded|failed)\.v1$/);
    }
  });
});
