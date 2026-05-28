export const AMQP_EXCHANGES = {
  walletCommands: "wallet.commands",
  walletEvents: "wallet.events",
} as const;

export const WALLET_COMMAND_ROUTING_KEYS = {
  debitRequestV1: "wallet.debit.request.v1",
  creditRequestV1: "wallet.credit.request.v1",
} as const;

export const WALLET_EVENT_ROUTING_KEYS = {
  debitSucceededV1: "wallet.debit.succeeded.v1",
  debitFailedV1: "wallet.debit.failed.v1",
  creditSucceededV1: "wallet.credit.succeeded.v1",
  creditFailedV1: "wallet.credit.failed.v1",
} as const;
