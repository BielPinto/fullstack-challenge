import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  GAME_WS_EVENTS,
  type WsBetPayloadV1,
  type WsRoundCrashedPayloadV1,
  type WsRoundPhasePayloadV1,
  type WsRoundStatePayloadV1,
  type WsRoundTickPayloadV1,
} from "@/lib/game-ws-events";
import { useGameRealtimeStore } from "@/stores/game-realtime-store";

const socketUrl = (): string => import.meta.env.VITE_GAME_WS_URL ?? "http://localhost:4001";

export function useGameSocket(enabled: boolean): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const applyRoundState = useGameRealtimeStore((s) => s.applyRoundState);
  const applyTick = useGameRealtimeStore((s) => s.applyTick);
  const applyPhase = useGameRealtimeStore((s) => s.applyPhase);
  const applyBet = useGameRealtimeStore((s) => s.applyBet);
  const applyCrashed = useGameRealtimeStore((s) => s.applyCrashed);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }
    const socket: Socket = io(socketUrl(), {
      transports: ["polling", "websocket"],
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 20,
    });

    const onConnect = (): void => setConnected(true);
    const onDisconnect = (): void => setConnected(false);

    const onState = (p: WsRoundStatePayloadV1) => applyRoundState(p);
    const onTick = (p: WsRoundTickPayloadV1) => applyTick(p);
    const onPhase = (p: WsRoundPhasePayloadV1) => applyPhase(p);
    const onPlaced = (b: WsBetPayloadV1) => applyBet(b);
    const onCash = (b: WsBetPayloadV1) => applyBet(b);
    const onCrash = (p: WsRoundCrashedPayloadV1) => applyCrashed(p);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(GAME_WS_EVENTS.ROUND_STATE, onState);
    socket.on(GAME_WS_EVENTS.ROUND_TICK, onTick);
    socket.on(GAME_WS_EVENTS.ROUND_PHASE, onPhase);
    socket.on(GAME_WS_EVENTS.BET_PLACED, onPlaced);
    socket.on(GAME_WS_EVENTS.BET_CASHED_OUT, onCash);
    socket.on(GAME_WS_EVENTS.ROUND_CRASHED, onCrash);

    return () => {
      socket.io.opts.reconnection = false;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(GAME_WS_EVENTS.ROUND_STATE, onState);
      socket.off(GAME_WS_EVENTS.ROUND_TICK, onTick);
      socket.off(GAME_WS_EVENTS.ROUND_PHASE, onPhase);
      socket.off(GAME_WS_EVENTS.BET_PLACED, onPlaced);
      socket.off(GAME_WS_EVENTS.BET_CASHED_OUT, onCash);
      socket.off(GAME_WS_EVENTS.ROUND_CRASHED, onCrash);
      if (socket.connected) {
        socket.disconnect();
      } else {
        socket.close();
      }
      setConnected(false);
    };
  }, [enabled, applyRoundState, applyTick, applyPhase, applyBet, applyCrashed]);

  return { connected };
}
