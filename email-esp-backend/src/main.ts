import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://lucid-email-esp.vercel.app',
    'https://lucid-email-esp.vercel.app/',
  ];

  if (process.env.ALLOWED_ORIGIN) {
    allowedOrigins.push(process.env.ALLOWED_ORIGIN);
    // Also add with trailing slash if not present
    if (!process.env.ALLOWED_ORIGIN.endsWith('/')) {
      allowedOrigins.push(process.env.ALLOWED_ORIGIN + '/');
    }
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Normalize origin by removing trailing slash for comparison
      const normalizedOrigin = origin.replace(/\/$/, '');
      const normalizedAllowedOrigins = allowedOrigins.map((o) =>
        o.replace(/\/$/, ''),
      );

      if (normalizedAllowedOrigins.includes(normalizedOrigin)) {
        // Return the original origin (without trailing slash) to match browser expectations
        return callback(null, normalizedOrigin);
      }

      console.warn(
        `CORS blocked origin: ${origin} (normalized: ${normalizedOrigin})`,
      );
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Enable global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
