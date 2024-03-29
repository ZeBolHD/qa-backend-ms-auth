import { NestFactory } from "@nestjs/core";

import cookieParser from "cookie-parser";

import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.use(cookieParser());

  const config = new DocumentBuilder()
    .setTitle("Auth api")
    .setDescription("This api for auth")
    .setVersion("1.01")
    .setExternalDoc("Коллекция json", "/swagger-json")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("swagger", app, document);

  await app.listen(5500);
}
bootstrap();
