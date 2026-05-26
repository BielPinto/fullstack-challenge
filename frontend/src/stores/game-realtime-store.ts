import { create } from "zustand";
import type {
  WsBetPayloadV1,
  WsRoundCrashedPayloadV1,
  WsRoundPhasePayloadV1,
  WsRoundStatePayloadV1,
  WsRoundTickPayloadV1,
} from "@/lib/game-ws-events";

export type CrashFlash = {
  mult: string;
  at: number;
};

type GameRealtimeState = {
  round: WsRoundStatePayloadV1 | null;
  lastCrash: CrashFlash | null;
  multiplierSeries: number[];
  applyRoundState: (p: WsRoundStatePayloadV1) => void;
  applyTick: (p: WsRoundTickPayloadV1) => void;
  applyPhase: (p: WsRoundPhasePayloadV1) => void;
  applyBet: (b: WsBetPayloadV1) => void;
  applyCrashed: (p: WsRoundCrashedPayloadV1) => void;
  resetSeries: () => void;
};

function parseMult(s: string | null | undefined): number {
  if (s == null || s === "") {
    return 1;
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export const useGameRealtimeStore = create<GameRealtimeState>((set, get) => ({
  round: null,
  lastCrash: null,
  multiplierSeries: [1],

  resetSeries: () => set({ multiplierSeries: [1] }),

  applyRoundState: (p) => {
    const start = parseMult(p.currentMultiplier ?? "1");
    set({
      round: p,
      lastCrash: null,
      multiplierSeries: p.phase === "RUNNING" ? [start] : [1],
    });
  },

  applyTick: (p) => {
    const m = parseMult(p.currentMultiplier);
    set((s) => {
      const next = [...s.multiplierSeries, m].slice(-180);
      if (!s.round || s.round.id !== p.roundId) {
        return { multiplierSeries: next };
      }
      return {
        multiplierSeries: next,
        round: {
          ...s.round,
          phase: "RUNNING",
          currentMultiplier: p.currentMultiplier,
          runDurationMs: p.runDurationMs,
        },
      };
    });
  },

  applyPhase: (p) => {
    set((s) => {
      if (!s.round || s.round.id !== p.roundId) {
        return {};
      }
      return {
        round: {
          ...s.round,
          phase: p.phase,
          bettingEndsAt: p.bettingEndsAt,
          runningStartedAt: p.runningStartedAt,
        },
        multiplierSeries: p.phase === "RUNNING" ? [1] : s.multiplierSeries,
      };
    });
  },

  applyBet: (b) => {
    set((s) => {
      if (!s.round) {
        return {};
      }
      const others = s.round.bets.filter((x) => x.id !== b.id);
      return { round: { ...s.round, bets: [...others, b] } };
    });
  },

  applyCrashed: (p) => {
    const at = Date.now();
    set((s) => {
      if (!s.round || s.round.id !== p.roundId) {
        return { lastCrash: { mult: p.crashMultiplier, at } };
      }
      return {
        lastCrash: { mult: p.crashMultiplier, at },
        round: {
          ...s.round,
          phase: "SETTLED",
          crashMultiplier: p.crashMultiplier,
          settledAt: p.settledAt,
          currentMultiplier: p.crashMultiplier,
          runDurationMs: p.verify.runDurationMs,
        },
        multiplierSeries: [...get().multiplierSeries, parseMult(p.crashMultiplier)].slice(-180),
      };
    });
  },
}));
