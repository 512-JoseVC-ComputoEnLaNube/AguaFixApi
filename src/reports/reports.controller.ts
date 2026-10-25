import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MAX_PHOTO_BYTES,
  PhotoValidationPipe,
} from '../storage/photo-validation.pipe';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: {
        fileSize: MAX_PHOTO_BYTES,
        files: 1,
        fields: 4,
        fieldSize: 20 * 1024,
        parts: 6,
      },
    }),
  )
  create(
    @Body() dto: CreateReportDto,
    @UploadedFile(new PhotoValidationPipe()) photo: Express.Multer.File,
  ) {
    return this.reportsService.create(dto, photo);
  }

  @Get()
  findAll() {
    return this.reportsService.findAll();
  }
}
