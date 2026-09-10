import { config } from 'dotenv';
import * as env from 'env-var';

config({ quiet: true });

export const envs = {
  port: env.get('PORT').default('3000').asPortNumber(),
  database: {
    host: env.get('DB_HOST').required().asString(),
    port: env.get('DB_PORT').default('5432').asPortNumber(),
    username: env.get('DB_USERNAME').required().asString(),
    password: env.get('DB_PASSWORD').required().asString(),
    database: env.get('DB_NAME').required().asString(),
  },
  smtp: {
    host: env.get('SMTP_HOST').required().asString(),
    port: env.get('SMTP_PORT').required().asPortNumber(),
    secure: env.get('SMTP_SECURE').required().asBoolStrict(),
    user: env.get('SMTP_USER').required().asEmailString(),
    password: env.get('SMTP_PASSWORD').required().asString(),
  },
  mailFrom: env.get('MAIL_FROM').required().asEmailString(),
  maintenanceEmail: env.get('MAINTENANCE_EMAIL').required().asEmailString(),
};
