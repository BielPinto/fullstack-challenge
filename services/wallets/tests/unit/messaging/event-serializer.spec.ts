import { describe, expect, it } from "bun:test";
import type { WalletDebitRequestedV1 } from "@crash/contracts";
import {
  parseWalletCommand,
  serializeWalletEvent,
} from "../../../src/infrastructure/messaging/event-serializer";

describe("event-serializer", () => {
  it("round-trips bigint fields as strings on the wire", () => {
    const event: WalletDebitRequestedV1 = {
      type: "WalletDebitRequested",
      version: "v1",
      commandId: "cmd-1",
      correlationId: "corr-1",
      createdAt: "2026-05-25T00:00:00.000Z",
      userId: "user-1",
      gameRoundId: "round-1",
      betId: "bet-1",
      amount: { amountInCents: 150n, currency: "BRL" },
    };

    const wire = serializeWalletEvent(event);
    expect(wire).toContain('"150"');

    const parsed = parseWalletCommand(Buffer.from(wire));
    expect(parsed.amount.amountInCents).toBe(150n);
  });
});
