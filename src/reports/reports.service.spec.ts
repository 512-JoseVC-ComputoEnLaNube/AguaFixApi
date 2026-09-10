jest.mock('../config/envs', () => ({
  envs: { maintenanceEmail: 'maintenance@example.com' },
}));
jest.mock('../email/email.service', () => ({ EmailService: class {} }));

import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsRepository } from './reports.repository';
import { EmailService } from '../email/email.service';
import { Severity } from './entities/report.entity';

describe('ReportsService', () => {
  const dto = {
    address: 'Calle 1',
    description: 'Fuga',
    severity: Severity.HIGH,
    reporterPhone: '4771234567',
  };
  const saved = { id: 1, ...dto, isResolved: false, createdAt: new Date() };
  const repository = { create: jest.fn(), findAll: jest.fn() };
  const email = { sendEmail: jest.fn() };
  const service = new ReportsService(
    repository as unknown as ReportsRepository,
    email as unknown as EmailService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    repository.create.mockResolvedValue(saved);
    email.sendEmail.mockResolvedValue(undefined);
  });

  it('guarda una sola vez antes de enviar', async () => {
    expect(await service.create(dto)).toEqual(saved);
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
    expect(repository.create.mock.invocationCallOrder[0]).toBeLessThan(
      email.sendEmail.mock.invocationCallOrder[0],
    );
  });

  it('no envía correo si falla PostgreSQL', async () => {
    repository.create.mockRejectedValue(new Error('DB unavailable'));
    await expect(service.create(dto)).rejects.toThrow('DB unavailable');
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('responde 503 con reporte guardado y log seguro si falla correo', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    email.sendEmail.mockRejectedValue(new Error('UNSAFE_SMTP_DETAILS'));
    try {
      await service.create(dto);
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
    expect(JSON.stringify(log.mock.calls)).not.toContain('UNSAFE_SMTP_DETAILS');
    log.mockRestore();
  });
});
