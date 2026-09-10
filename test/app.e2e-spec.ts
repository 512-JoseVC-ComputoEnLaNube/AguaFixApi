import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/email/email.service';
import { createValidationPipe } from '../src/config/validation';
import { User } from '../src/users/entities/user.entity';
import { Report } from '../src/reports/entities/report.entity';

describe('AguaFixApi con PostgreSQL real y correo simulado', () => {
  let app: INestApplication;
  let database: DataSource;
  const sendEmail = jest.fn().mockResolvedValue(undefined);
  const runId = randomBytes(8).toString('hex');
  const email = `e2e-${runId}@example.com`;
  const password = randomBytes(18).toString('hex');
  const userIds: number[] = [];
  const reportIds: number[] = [];
  const reportBody = {
    address: `Prueba automatizada ${runId}`,
    description: '<b>Fuga</b> & banqueta',
    severity: 'high',
    reporterPhone: '4771234567',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({ sendEmail })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
    database = app.get(DataSource);
  });

  afterAll(async () => {
    if (database?.isInitialized) {
      if (reportIds.length)
        await database.getRepository(Report).delete(reportIds);
      if (userIds.length) await database.getRepository(User).delete(userIds);
    }
    if (app) await app.close();
  });

  it('registra, normaliza correo, guarda hash y aplica notificaciones true por defecto', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Prueba E2E', email: email.toUpperCase(), password })
      .expect(201);
    userIds.push(response.body.id as number);
    expect(response.body.email).toBe(email);
    expect(response.body.isNotificationEnabled).toBe(true);
    expect(response.body).not.toHaveProperty('password');
    const stored = await database
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: response.body.id })
      .getOneOrFail();
    expect(stored.password).not.toBe(password);
    expect(await bcrypt.compare(password, stored.password)).toBe(true);
  });

  it('rechaza registro duplicado sin distinguir mayúsculas', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Duplicado', email: email.toUpperCase(), password })
      .expect(409);
    expect(response.body.message).toBe('El correo ya está registrado');
  });

  it('permite login y oculta hash', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email.toUpperCase(), password })
      .expect(200);
    expect(response.body.message).toBe('Inicio de sesión exitoso');
    expect(response.body.user).not.toHaveProperty('password');
  });

  it.each([email, `missing-${runId}@example.com`])(
    'devuelve error genérico con credenciales inválidas: %s',
    async (loginEmail) => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: loginEmail, password: randomBytes(12).toString('hex') })
        .expect(400);
      expect(response.body.message).toBe('Correo o contraseña incorrectos');
    },
  );

  it('guarda un reporte y envía HTML escapado una sola vez', async () => {
    sendEmail.mockClear();
    const response = await request(app.getHttpServer())
      .post('/reports')
      .send(reportBody)
      .expect(201);
    reportIds.push(response.body.id as number);
    expect(response.body.isResolved).toBe(false);
    expect(response.body.createdAt).toBeDefined();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][2]).toContain(
      '&lt;b&gt;Fuga&lt;/b&gt; &amp; banqueta',
    );
    expect(
      await database
        .getRepository(Report)
        .countBy({ address: reportBody.address }),
    ).toBe(1);
  });

  it('rechaza severidad inválida y campos de servidor antes de guardar o enviar', async () => {
    sendEmail.mockClear();
    await request(app.getHttpServer())
      .post('/reports')
      .send({ ...reportBody, severity: 'urgent' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/reports')
      .send({
        ...reportBody,
        id: 900,
        isResolved: true,
        createdAt: new Date().toISOString(),
      })
      .expect(400);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(
      await database
        .getRepository(Report)
        .countBy({ address: reportBody.address }),
    ).toBe(1);
  });

  it('conserva exactamente un reporte si falla SMTP y devuelve el reporte guardado', async () => {
    sendEmail.mockRejectedValueOnce(new Error('Fallo de SMTP simulado'));
    const address = `${reportBody.address} fallo SMTP`;
    const response = await request(app.getHttpServer())
      .post('/reports')
      .send({ ...reportBody, address })
      .expect(503);
    reportIds.push(response.body.report.id as number);
    expect(response.body.code).toBe('REPORT_SAVED_NOTIFICATION_FAILED');
    expect(response.body.message).toContain('El reporte se guardó');
    expect(await database.getRepository(Report).countBy({ address })).toBe(1);
  });

  it('lista reportes del más reciente al más antiguo', async () => {
    const response = await request(app.getHttpServer())
      .get('/reports')
      .expect(200);
    const reports = response.body as Array<{ id: number; createdAt: string }>;
    expect(reports.map((report) => report.id)).toEqual(
      expect.arrayContaining(reportIds),
    );
    for (let index = 1; index < reports.length; index++) {
      expect(
        new Date(reports[index - 1].createdAt).getTime(),
      ).toBeGreaterThanOrEqual(new Date(reports[index].createdAt).getTime());
    }
  });
});
