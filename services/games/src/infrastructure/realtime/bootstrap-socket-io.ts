import type { INestApplication } from "@nestjs/common";
import type { Server as HttpServer } from "node:http";
import { Server as EngineServer } from "engine.io";
import type { Express } from "express";
import { Server as SocketIOServer } from "socket.io";
import { GameGateway } from "../../presentation/ws/game.gateway";

function resolveWsCorsOrigin(): boolean | string[] {
  const wsCorsOrigin = process.env.WS_CORS_ORIGIN ?? "*";
  return wsCorsOrigin === "*" ? true : wsCorsOrigin.split(",").map((o) => o.trim());
}

export type SocketIoStack = {
  io: SocketIOServer;
  engine: EngineServer;
};

/** Mount Engine.IO on Express before Nest routes (Bun-compatible). */
export function mountSocketIoOnExpress(expressApp: Express, httpServer: HttpServer): SocketIoStack {
  const corsOrigin = resolveWsCorsOrigin();
  const engine = new EngineServer({
    cors: { origin: corsOrigin },
    transports: ["websocket", "polling"],
  });

  const io = new SocketIOServer({
    cors: { origin: corsOrigin },
    transports: ["websocket", "polling"],
  });
  io.bind(engine);

  expressApp.use((req, res, next) => {
    const url = req.url ?? "";
    if (!url.startsWith("/socket.io")) {
      next();
      return;
    }
    engine.handleRequest(req, res);
  });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = req.url ?? "";
    if (url.startsWith("/socket.io")) {
      engine.handleUpgrade(req, socket, head);
    }
  });

  return { io, engine };
}

export function wireSocketIoGateway(app: INestApplication, io: SocketIOServer): void {
  const gateway = app.get(GameGateway);
  gateway.afterInit(io);
  io.on("connection", (client) => {
    void gateway.handleConnection(client);
  });
}
