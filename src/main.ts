import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 配置 CORS，允许前端跨域请求（本地 + 线上 FRONTEND_URL）
  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    'http://127.0.0.1:3001',
    process.env.FRONTEND_URL,
  ].filter((origin): origin is string => Boolean(origin));

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 只保留白名单中的属性
      forbidNonWhitelisted: true, // 禁止非白名单中的属性
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
