import { NestFactory } from "@nestjs/core";

import cookieParser from "cookie-parser";
import { Logger } from "nestjs-pino";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const HOST = configService.get<string>("HOST_AUTH_URL");

  app.useLogger(app.get(Logger));

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.use(cookieParser());

  const config = new DocumentBuilder()
    .setTitle("Auth API")
    .setDescription("This API for auth")
    .setVersion("1.03.1")
    .addServer(HOST, "API server")
    .addBearerAuth()
    .setExternalDoc("Коллекция json", HOST + "/swagger-json")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("swagger", app, document);

  await app.listen(5500);
}
bootstrap();
