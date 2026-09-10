import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1789080000000 implements MigrationInterface {
  name = 'InitialSchema1789080000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "SYSTEM_USER" (
      "id" SERIAL NOT NULL,
      "name" character varying(120) NOT NULL,
      "email" character varying(254) NOT NULL,
      "password" character varying(60) NOT NULL,
      "isNotificationEnabled" boolean NOT NULL DEFAULT true,
      CONSTRAINT "UQ_SYSTEM_USER_email" UNIQUE ("email"),
      CONSTRAINT "PK_SYSTEM_USER" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE TABLE "WATER_REPORT" (
      "id" SERIAL NOT NULL,
      "address" character varying(500) NOT NULL,
      "description" text NOT NULL,
      "severity" character varying(6) NOT NULL,
      "reporterPhone" character varying(25) NOT NULL,
      "isResolved" boolean NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "CHK_WATER_REPORT_severity" CHECK ("severity" IN ('low', 'medium', 'high')),
      CONSTRAINT "PK_WATER_REPORT" PRIMARY KEY ("id")
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "WATER_REPORT"');
    await queryRunner.query('DROP TABLE "SYSTEM_USER"');
  }
}
