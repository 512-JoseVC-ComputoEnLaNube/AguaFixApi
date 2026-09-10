jest.mock('../config/envs', () => ({
  envs: {
    smtp: {
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      user: 'sender@example.com',
      password: '',
    },
    mailFrom: 'sender@example.com',
  },
}));
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';
import { Logger } from '@nestjs/common';

describe('EmailService', () => {
  const sendMail = jest.fn();
  const close = jest.fn();
  let service: EmailService;
  beforeEach(() => {
    jest.resetAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail,
      close,
    });
    service = new EmailService();
  });

  it('envía desde la dirección configurada y exige aceptación del destinatario', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    sendMail.mockResolvedValue({ accepted: ['maintenance@example.com'] });
    await service.sendEmail(
      'maintenance@example.com',
      'Reporte',
      '<p>Fuga</p>',
    );
    expect(sendMail).toHaveBeenCalledWith({
      from: 'sender@example.com',
      to: 'maintenance@example.com',
      subject: 'Reporte',
      html: '<p>Fuga</p>',
    });
    service.onModuleDestroy();
    expect(close).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it('rechaza una respuesta sin destinatario aceptado', async () => {
    sendMail.mockResolvedValue({ accepted: [] });
    await expect(
      service.sendEmail('maintenance@example.com', 'Reporte', '<p>Fuga</p>'),
    ).rejects.toThrow('No se pudo enviar la notificación por correo');
  });

  it('no propaga detalles sensibles del error SMTP', async () => {
    sendMail.mockRejectedValue(new Error('UNSAFE_SMTP_DETAILS'));
    await expect(
      service.sendEmail('maintenance@example.com', 'Reporte', '<p>Fuga</p>'),
    ).rejects.toThrow('No se pudo enviar la notificación por correo');
  });
});
