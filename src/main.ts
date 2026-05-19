import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().disable('etag');
  const rawOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Entries wrapped in /…/ are treated as regex patterns (e.g. /.*\.akaikumogo\.uz$/)
  const originList: (string | RegExp)[] = rawOrigins.map((o) => {
    const m = o.match(/^\/(.+)\/([gimsuy]*)$/);
    return m ? new RegExp(m[1], m[2]) : o;
  });

  app.enableCors({
    origin: originList.length ? originList : true,
    credentials: true,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.setHeader(
      'cache-control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    res.setHeader('pragma', 'no-cache');
    res.setHeader('expires', '0');
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Shoxsaroy API')
    .setDescription(
      'Multi-tenant CRM + public showroom; JWT; blocks/floors/apartments; contracts; MQTT',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
