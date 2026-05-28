/** Socket.IO event names (server → client only). */
export const GAME_WS_EVENTS = {
  ROUND_STATE: "round:state",
  ROUND_PHASE: "round:phase",
  ROUND_TICK: "round:tick",
  ROUND_CRASHED: "round:crashed",
  BET_PLACED: "bet:placed",
  BET_CASHED_OUT: "bet:cashed_out",
} as const;

export type GameWsEventName = (typeof GAME_WS_EVENTS)[keyof typeof GAME_WS_EVENTS];

export type WsBetPayloadV1 = {
  id: string;
  userId: string;
  amount: string;
  status: string;
  cashoutMultiplier: string | null;
  payout: string | null;
  /** Target multiplier for server-side auto cashout (optional). */
  autoCashoutMultiplier?: string | null;
};

export type WsRoundStatePayloadV1 = {
  id: string;
  phase: string;
  commitHash: string;
  clientSeed: string;
  nonce: string;
  bettingEndsAt: string;
  runningStartedAt: string | null;
  settledAt: string | null;
  crashMultiplier: string | null;
  currentMultiplier: string | null;
  runDurationMs: number | null;
  bets: WsBetPayloadV1[];
};

export type WsRoundPhasePayloadV1 = {
  roundId: string;
  phase: string;
  bettingEndsAt: string;
  runningStartedAt: string | null;
};

export type WsRoundTickPayloadV1 = {
  roundId: string;
  currentMultiplier: string;
  elapsedMs: number;
  runDurationMs: number;
};

export type WsRoundCrashedPayloadV1 = {
  roundId: string;
  crashMultiplier: string;
  settledAt: string;
  verify: {
    commitHash: string;
    serverSecret: string;
    clientSeed: string;
    nonce: string;
    runDurationMs: number;
  };
};
