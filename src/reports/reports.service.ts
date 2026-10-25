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
import { StorageService } from '../storage/storage.service';
import { Report } from './entities/report.entity';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly emailService: EmailService,
    private readonly storageService: StorageService,
  ) {}

  async create(dto: CreateReportDto, photo: Express.Multer.File) {
    const photoUrl = await this.storageService.uploadFile(photo, 'reports');
    let report: Report;
    try {
      report = await this.reportsRepository.create(dto, photoUrl);
    } catch {
      await this.storageService.deleteFile(photoUrl);
      throw new ServiceUnavailableException(
        'No se pudo guardar el reporte; revisa la base de datos',
      );
    }
    try {
      await this.emailService.sendEmail(
        envs.maintenanceEmail,
        'Nuevo reporte de fuga de agua',
        generateReportTemplate(dto, photoUrl),
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

  async findAll() {
    const reports = await this.reportsRepository.findAll();
    return reports.map((report) => ({ ...report, repairPhotoUrl: null }));
  }
}
