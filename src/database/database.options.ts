import { DataSourceOptions } from 'typeorm';
import { join } from 'node:path';
import { envs } from '../config/envs';
import { User } from '../users/entities/user.entity';
import { Report } from '../reports/entities/report.entity';

export const databaseOptions: DataSourceOptions = {
  type: 'postgres',
  ...envs.database,
  entities: [User, Report],
  migrations: [join(__dirname, '..', 'migrations', '*{.ts,.js}')],
  synchronize: false,
  logging: false,
};
