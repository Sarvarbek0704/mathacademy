import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

declare global {
  var __bigint_json_patch_applied__: boolean | undefined;
}

function patchBigIntJson() {
  if (global.__bigint_json_patch_applied__) return;
  global.__bigint_json_patch_applied__ = true;
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

function parseOrigins(v?: string): string[] {
  return String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

function matchesWildcard(origin: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    if (!p.includes('*')) return false;
    const regex = new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return regex.test(origin);
  });
}

async function bootstrap() {
  patchBigIntJson();

  const app = await NestFactory.create(AppModule, {});
  const globalPrefix = 'api';
  const port = Number(process.env.PORT) || 4000;

  const uploadDir = resolve(process.env.UPLOAD_DIR || 'uploads');
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  app.use(
    '/uploads',
    express.static(uploadDir, {
      maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
      etag: true,
      fallthrough: true,
    }),
  );

  app.setGlobalPrefix(globalPrefix);
  app.use(cookieParser());

  const frontendPort = Number(process.env.WEB_PORT) || 3000;
  const parsedOrigins = parseOrigins(process.env.WEB_ORIGINS);
  const exactOrigins = parsedOrigins.filter((o) => !o.includes('*'));
  const wildcardOrigins = parsedOrigins.filter((o) => o.includes('*'));

  const allowSet = new Set([
    `http://localhost:${frontendPort}`,
    `http://127.0.0.1:${frontendPort}`,
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    ...exactOrigins,
  ]);
  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: (origin, callback) => {
      // Non-browser clients (curl/postman/server-to-server)
      if (!origin) return callback(null, true);

      // Explicitly allowed origins from env/defaults
      if (allowSet.has(origin)) return callback(null, true);

      // Wildcard pattern matches (e.g. https://*.vercel.app)
      if (matchesWildcard(origin, wildcardOrigins)) return callback(null, true);

      // Development convenience: allow localhost/127.0.0.1 with any port
      if (!isProduction && isLocalDevOrigin(origin))
        return callback(null, true);

      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const isDev = process.env.NODE_ENV !== 'production';
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: (errors) => {
        if (isDev) {
          console.warn('Validation errors:', JSON.stringify(errors, null, 2));
        }
        return new BadRequestException(errors);
      },
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      forbidUnknownValues: false,
      validationError: { target: false, value: false },
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // ENABLE_SWAGGER used to be declared in .env.example and never read here, so
  // setting it to "false" did nothing and /api/docs was served in production —
  // publishing every route and DTO to anyone who asked. Default off in
  // production, on everywhere else.
  const swaggerEnabled =
    process.env.ENABLE_SWAGGER !== undefined
      ? process.env.ENABLE_SWAGGER === 'true'
      : isDev;

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Mathacademy Digital Campus API')
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);
  console.log(`Server started on http://localhost:${port}/api`);
  if (swaggerEnabled) {
    console.log(`Swagger started on http://localhost:${port}/api/docs`);
  }
}

bootstrap();
