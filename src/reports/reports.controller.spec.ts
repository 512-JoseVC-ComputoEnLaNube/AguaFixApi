jest.mock('../config/envs', () => ({
  envs: { maintenanceEmail: 'maintenance@example.com', storage: {} },
}));

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { createValidationPipe } from '../config/validation';
import { MAX_PHOTO_BYTES } from '../storage/photo-validation.pipe';

describe('POST /reports multipart', () => {
  let app: INestApplication;
  const create = jest
    .fn()
    .mockImplementation((dto, photo) => ({ ...dto, type: photo.mimetype }));
  const body = {
    address: ' Calle 1 ',
    description: 'Fuga',
    severity: 'high',
    reporterPhone: '4771234567',
  };
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: { create } }],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });
  beforeEach(() => create.mockClear());
  afterAll(async () => app.close());

  it('recibe los cuatro campos de texto, normaliza y detecta el contenido real', async () => {
    const response = await request(app.getHttpServer())
      .post('/reports')
      .field(body)
      .attach('photo', png, { filename: 'fake.html', contentType: 'text/html' })
      .expect(201);
    expect(response.body).toMatchObject({
      address: 'Calle 1',
      severity: 'high',
      reporterPhone: '4771234567',
      type: 'image/png',
    });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('rechaza un reporte sin photo con 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/reports')
      .field(body)
      .expect(400);
    expect(response.body.message).toBe('El archivo photo es obligatorio');
    expect(create).not.toHaveBeenCalled();
  });
  it('rechaza texto disfrazado de imagen y no llama al servicio', async () => {
    await request(app.getHttpServer())
      .post('/reports')
      .field(body)
      .attach('photo', Buffer.from('not an image'), 'fake.png')
      .expect(400);
    expect(create).not.toHaveBeenCalled();
  });
  it('limita el tamaño antes de llamar al servicio', async () => {
    await request(app.getHttpServer())
      .post('/reports')
      .field(body)
      .attach(
        'photo',
        Buffer.concat([png, Buffer.alloc(MAX_PHOTO_BYTES)]),
        'large.png',
      )
      .expect(413);
    expect(create).not.toHaveBeenCalled();
  });
  it('acepta exactamente 5 MiB', async () => {
    await request(app.getHttpServer())
      .post('/reports')
      .field(body)
      .attach(
        'photo',
        Buffer.concat([png, Buffer.alloc(MAX_PHOTO_BYTES - png.length)]),
        'limit.png',
      )
      .expect(201);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...body, severity: 'urgent' },
    { ...body, address: ' ' },
    { ...body, reporterPhone: '123' },
    { ...body, photoUrl: 'https://example.com/injected.png' },
    { ...body, repairPhotoUrl: 'https://example.com/repair.png' },
  ])('rechaza campos inválidos antes de subir o guardar', async (fields) => {
    await request(app.getHttpServer())
      .post('/reports')
      .field(fields)
      .attach('photo', png, 'photo.png')
      .expect(400);
    expect(create).not.toHaveBeenCalled();
  });
  it('rechaza otro nombre de archivo y más de una foto', async () => {
    await request(app.getHttpServer())
      .post('/reports')
      .field(body)
      .attach('file', png, 'photo.png')
      .expect(400);
    await request(app.getHttpServer())
      .post('/reports')
      .field(body)
      .attach('photo', png, 'one.png')
      .attach('photo', png, 'two.png')
      .expect(400);
    expect(create).not.toHaveBeenCalled();
  });
});
