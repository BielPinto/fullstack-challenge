import "reflect-metadata";
import { createServer } from "node:http";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";
import { AppModule } from "./app.module";
import { NodeHttpIoAdapter } from "./infrastructure/realtime/node-http-io.adapter";

async function bootstrap(): Promise<void> {
  const expressApp = express();
  const httpServer = createServer(expressApp);
  const httpAdapter = new ExpressAdapter(expressApp);
  httpAdapter.setHttpServer(httpServer);

  const app = await NestFactory.create(AppModule, httpAdapter);
  app.useWebSocketAdapter(new NodeHttpIoAdapter(httpServer));

  const port = Number(process.env.PORT ?? 4001);
  await app.listen(port, "0.0.0.0");
  console.log(`Games service running on port ${port} (REST + Socket.IO)`);
}

bootstrap();
