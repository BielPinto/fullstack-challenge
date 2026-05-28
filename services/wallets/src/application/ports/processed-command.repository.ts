import type { WalletResultEventV1 } from "@crash/contracts";

export const PROCESSED_COMMAND_REPOSITORY = Symbol("PROCESSED_COMMAND_REPOSITORY");

export interface ProcessedCommandRecord {
  commandId: string;
  resultEvent: WalletResultEventV1;
}

export interface ProcessedCommandRepository {
  findByCommandId(commandId: string): Promise<ProcessedCommandRecord | null>;
  save(record: ProcessedCommandRecord): Promise<void>;
}
