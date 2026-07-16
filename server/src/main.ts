import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as bodyParser from 'body-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 解析 application/x-www-form-urlencoded（用于重新发起共享确认表单）
  app.use(bodyParser.urlencoded({ extended: false }));

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useWebSocketAdapter(new IoAdapter(app));

  // 生产环境静态托管前端构建产物
  const webDist = join(__dirname, '..', '..', 'web', 'dist');
  app.useStaticAssets(webDist, {
    index: false,
  });

  // SPA fallback：非 API、非 socket.io、非静态文件的 GET 请求返回 index.html
  app.use((req: any, res: any, next: any) => {
    if (
      req.method === 'GET' &&
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/socket.io') &&
      !/\.[a-zA-Z0-9]+$/.test(req.path)
    ) {
      return res.sendFile(join(webDist, 'index.html'));
    }
    next();
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3520;
  await app.listen(port);
  console.log(`xgoatcast server running on http://localhost:${port}`);
}

bootstrap();
