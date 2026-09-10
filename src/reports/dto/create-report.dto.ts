import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length, Matches } from 'class-validator';
import { Severity } from '../entities/report.entity';

export class CreateReportDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 500)
  address: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 5000)
  description: string;

  @IsEnum(Severity)
  severity: Severity;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 25)
  @Matches(/^\+?(?=(?:\D*\d){10,15}\D*$)[\d ()-]+$/, {
    message:
      'reporterPhone debe contener entre 10 y 15 dígitos; se permiten + inicial, espacios, paréntesis y guiones',
  })
  reporterPhone: string;
}
