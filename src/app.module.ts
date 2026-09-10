import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ReportsModule } from './reports/reports.module';
import { databaseOptions } from './database/database.options';

@Module({
  imports: [
    TypeOrmModule.forRoot({ ...databaseOptions, synchronize: false }),
    AuthModule,
    ReportsModule,
  ],
})
export class AppModule {}
