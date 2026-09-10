import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { envs } from './config/envs';
import { createValidationPipe } from './config/validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();
  await app.listen(envs.port);
}

void bootstrap().catch(() => {
  console.error(
    'No se pudo iniciar AguaFixApi. Revisa el entorno y PostgreSQL.',
  );
  process.exitCode = 1;
});
