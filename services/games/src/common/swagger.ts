import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupSwagger(app: INestApplication, serviceName: string): void {
  const config = new DocumentBuilder()
    .setTitle(`${serviceName} API`)
    .setDescription(`HTTP API for the Crash Game ${serviceName} service`)
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Keycloak access token (realm crash-game)",
      },
      "jwt",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);
}
