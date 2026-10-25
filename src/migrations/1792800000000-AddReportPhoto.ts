import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportPhoto1792800000000 implements MigrationInterface {
  name = 'AddReportPhoto1792800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "WATER_REPORT" ADD COLUMN "photoUrl" text',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "WATER_REPORT" DROP COLUMN "photoUrl"',
    );
  }
}
