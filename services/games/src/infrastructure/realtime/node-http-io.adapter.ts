import { IoAdapter } from "@nestjs/platform-socket.io";
import type { Server as HttpServer } from "node:http";
import { Server, type ServerOptions } from "socket.io";

/**
 * Socket.IO engine.io expects a Node.js `http.Server` (with `.listeners()`).
 * Bun's default Nest HTTP server does not implement that API — attach to an
 * explicit `node:http` server created in `main.ts` instead.
 */
export class NodeHttpIoAdapter extends IoAdapter {
  constructor(private readonly nodeHttpServer: HttpServer) {
    super();
  }

  createIOServer(port: number, options?: ServerOptions & { namespace?: unknown }): Server {
    if (options?.namespace) {
      return super.createIOServer(port, options) as Server;
    }
    return new Server(this.nodeHttpServer, options);
  }
}
