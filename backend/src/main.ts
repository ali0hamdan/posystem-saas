import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { initBackendSentry } from './instrumentation/sentry.instrumentation';
import { SanitizeInterceptor } from './common/interceptors/sanitize.interceptor';

async function bootstrap(): Promise<void> {
  initBackendSentry();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  if (config.get<boolean>('security.trustProxy')) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');

  const isProd = config.get<string>('app.nodeEnv') === 'production';

  if (isProd && (config.get<string>('app.corsOrigin') ?? '*') === '*') {
    throw new Error('CORS_ORIGIN must be explicitly set to a non-wildcard value in production');
  }

  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'none'"],
              frameAncestors: ["'none'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
            },
          }
        : false, // Disable in dev so Swagger UI works
      crossOriginEmbedderPolicy: isProd,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hidePoweredBy: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      frameguard: { action: 'deny' },
      hsts: isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    }),
  );
  app.use(compression());

  const corsOrigin = config.get<string>('app.corsOrigin') ?? '*';
  const originsList =
    corsOrigin === '*'
      ? true
      : corsOrigin
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);

  app.enableCors({
    origin: originsList,
    credentials: corsOrigin !== '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Branch-Id', 'X-License-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400,
  });

  // Global sanitization interceptor (strips HTML from all string inputs)
  app.useGlobalInterceptors(new SanitizeInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger / OpenAPI — only available outside production (or behind auth in prod)
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Stock POS API')
      .setDescription('POS & Inventory Management REST API')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-License-Token' }, 'license')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Branch-Id' }, 'branch')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log('Swagger UI available at /api/docs');
  }

  const port = config.get<number>('app.port') ?? 3000;
  const host = config.get<string>('app.host') ?? '0.0.0.0';
  await app.listen(port, host);
  logger.log(`HTTP server listening on ${host}:${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
