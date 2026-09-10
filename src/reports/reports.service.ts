import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ReportsRepository } from './reports.repository';
import { EmailService } from '../email/email.service';
import { CreateReportDto } from './dto/create-report.dto';
import { generateReportTemplate } from './templates/report.template';
import { envs } from '../config/envs';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateReportDto) {
    const report = await this.reportsRepository.create(dto);
    try {
      await this.emailService.sendEmail(
        envs.maintenanceEmail,
        'Nuevo reporte de fuga de agua',
        generateReportTemplate(dto),
      );
    } catch {
      this.logger.error(
        `Reporte ${report.id} guardado; la notificación por correo no pudo enviarse.`,
      );
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'REPORT_SAVED_NOTIFICATION_FAILED',
        message:
          'El reporte se guardó, pero la notificación no pudo enviarse. No repitas la solicitud; consulta GET /reports.',
        report,
      });
    }
    return report;
  }

  findAll() {
    return this.reportsRepository.findAll();
  }
}
