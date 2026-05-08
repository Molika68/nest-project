import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 只保留白名单中的属性
      forbidNonWhitelisted: true, // 禁止非白名单中的属性
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
