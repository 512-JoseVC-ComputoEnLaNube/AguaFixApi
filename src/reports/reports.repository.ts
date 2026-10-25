import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsRepository {
  constructor(
    @InjectRepository(Report) private readonly repository: Repository<Report>,
  ) {}

  create(dto: CreateReportDto, photoUrl: string): Promise<Report> {
    return this.repository.save(this.repository.create({ ...dto, photoUrl }));
  }

  findAll(): Promise<Report[]> {
    return this.repository.find({ order: { createdAt: 'DESC', id: 'DESC' } });
  }
}
