import "reflect-metadata";
import { createServer } from "node:http";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";
import { AppModule } from "./app.module";
import { setupSwagger } from "./common/swagger";
import {
  mountSocketIoOnExpress,
  wireSocketIoGateway,
} from "./infrastructure/realtime/bootstrap-socket-io";

async function bootstrap(): Promise<void> {
  const expressApp = express();
  const httpServer = createServer(expressApp);
  const httpAdapter = new ExpressAdapter(expressApp);
  httpAdapter.setHttpServer(httpServer);

  const { io } = mountSocketIoOnExpress(expressApp, httpServer);

  const app = await NestFactory.create(AppModule, httpAdapter);
  setupSwagger(app, "Games");

  await app.init();
  wireSocketIoGateway(app, io);

  const port = Number(process.env.PORT ?? 4001);
  await app.listen(port, "0.0.0.0");
  console.log(`Games service running on port ${port} (REST + Socket.IO)`);
}

bootstrap();
