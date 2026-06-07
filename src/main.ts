import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { requestIdMiddleware } from './common/request-id.middleware';
import { AppLogger } from './common/logger/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  const config = app.get(ConfigService);
  const isProd = config.get<string>('NODE_ENV') === 'production';

  app.getHttpAdapter().getInstance().disable('etag');
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(requestIdMiddleware);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
  );

  const rawOrigins = (config.get<string>('CORS_ORIGIN') ?? '')
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
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(logger));

  app.enableShutdownHooks();

  if (!isProd) {
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
  }

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  logger.log(`HTTP server listening on port ${port} (env=${isProd ? 'production' : config.get<string>('NODE_ENV')})`, 'Bootstrap');
}

void bootstrap();
