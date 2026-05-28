import { Injectable } from "@nestjs/common";
import type { WalletResultEventV1 } from "@crash/contracts";
import type {
  ProcessedCommandRecord,
  ProcessedCommandRepository,
} from "../../application/ports/processed-command.repository";
import {
  parseWalletResult,
  serializeWalletResult,
} from "../messaging/event-serializer";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PrismaProcessedCommandRepository implements ProcessedCommandRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCommandId(commandId: string): Promise<ProcessedCommandRecord | null> {
    const row = await this.prisma.processedCommand.findUnique({
      where: { commandId },
    });
    if (!row) {
      return null;
    }
    const resultEvent = parseWalletResult(JSON.stringify(row.resultJson));
    return { commandId: row.commandId, resultEvent };
  }

  async save(record: ProcessedCommandRecord): Promise<void> {
    const payload = JSON.parse(serializeWalletResult(record.resultEvent)) as object;
    await this.prisma.processedCommand.create({
      data: {
        commandId: record.commandId,
        resultType: record.resultEvent.type,
        resultJson: payload,
      },
    });
  }
}
