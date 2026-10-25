jest.mock('../config/envs', () => ({
  envs: { maintenanceEmail: 'maintenance@example.com' },
}));
jest.mock('../email/email.service', () => ({ EmailService: class {} }));
jest.mock('../storage/storage.service', () => ({ StorageService: class {} }));

import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsRepository } from './reports.repository';
import { EmailService } from '../email/email.service';
import { Severity } from './entities/report.entity';
import { StorageService } from '../storage/storage.service';

describe('ReportsService', () => {
  const dto = {
    address: 'Calle 1',
    description: 'Fuga',
    severity: Severity.HIGH,
    reporterPhone: '4771234567',
  };
  const photoUrl = 'https://example.com/reports/test.png';
  const photo = {
    buffer: Buffer.from('photo'),
    mimetype: 'image/png',
  } as Express.Multer.File;
  const saved = {
    id: 1,
    ...dto,
    photoUrl,
    isResolved: false,
    createdAt: new Date(),
  };
  const repository = { create: jest.fn(), findAll: jest.fn() };
  const email = { sendEmail: jest.fn() };
  const storage = { uploadFile: jest.fn(), deleteFile: jest.fn() };
  const service = new ReportsService(
    repository as unknown as ReportsRepository,
    email as unknown as EmailService,
    storage as unknown as StorageService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    repository.create.mockResolvedValue(saved);
    email.sendEmail.mockResolvedValue(undefined);
    storage.uploadFile.mockResolvedValue(photoUrl);
    storage.deleteFile.mockResolvedValue(undefined);
  });

  it('guarda una sola vez antes de enviar', async () => {
    expect(await service.create(dto, photo)).toEqual(saved);
    expect(storage.uploadFile).toHaveBeenCalledWith(photo, 'reports');
    expect(repository.create).toHaveBeenCalledWith(dto, photoUrl);
    expect(storage.uploadFile.mock.invocationCallOrder[0]).toBeLessThan(
      repository.create.mock.invocationCallOrder[0],
    );
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
    expect(repository.create.mock.invocationCallOrder[0]).toBeLessThan(
      email.sendEmail.mock.invocationCallOrder[0],
    );
  });

  it('no envía correo si falla PostgreSQL', async () => {
    repository.create.mockRejectedValue(new Error('DB unavailable'));
    await expect(service.create(dto, photo)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(storage.deleteFile).toHaveBeenCalledWith(photoUrl);
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('no guarda ni envía correo si falla S3', async () => {
    storage.uploadFile.mockRejectedValue(new ServiceUnavailableException());
    await expect(service.create(dto, photo)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(repository.create).not.toHaveBeenCalled();
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('incluye null para fotos históricas y reparación sin inventar URLs', async () => {
    repository.findAll.mockResolvedValue([{ ...saved, photoUrl: null }]);
    expect(await service.findAll()).toEqual([
      { ...saved, photoUrl: null, repairPhotoUrl: null },
    ]);
  });

  it('responde 503 con reporte guardado y log seguro si falla correo', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    email.sendEmail.mockRejectedValue(new Error('UNSAFE_SMTP_DETAILS'));
    try {
      await service.create(dto, photo);
      throw new Error('Se esperaba error 503');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(
        (error as ServiceUnavailableException).getResponse(),
      ).toMatchObject({
        statusCode: 503,
        code: 'REPORT_SAVED_NOTIFICATION_FAILED',
        report: saved,
      });
    }
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(storage.deleteFile).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('UNSAFE_SMTP_DETAILS');
    log.mockRestore();
  });
});
