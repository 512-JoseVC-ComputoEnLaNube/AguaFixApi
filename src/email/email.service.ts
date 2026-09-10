import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { envs } from '../config/envs';

@Injectable()
export class EmailService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter = nodemailer.createTransport({
    host: envs.smtp.host,
    port: envs.smtp.port,
    secure: envs.smtp.secure,
    auth: { user: envs.smtp.user, pass: envs.smtp.password },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    logger: false,
    debug: false,
  });

  async sendEmail(
    to: string,
    subject: string,
    template: string,
  ): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: envs.mailFrom,
        to,
        subject,
        html: template,
      });
      if (
        !info.accepted.some(
          (address) => String(address).toLowerCase() === to.toLowerCase(),
        )
      ) {
        throw new Error('Recipient not accepted');
      }
      this.logger.log(
        'El servidor SMTP aceptó la notificación para mantenimiento.',
      );
    } catch {
      // No se propaga el error original: puede incluir datos del servidor o credenciales.
      throw new Error('No se pudo enviar la notificación por correo');
    }
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
