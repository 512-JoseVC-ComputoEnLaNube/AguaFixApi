import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
  ValidateBy,
} from 'class-validator';

export class CreateUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  name: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(8, 72)
  @ValidateBy({
    name: 'bcryptMaxBytes',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72,
      defaultMessage: () => 'password debe contener como máximo 72 bytes UTF-8',
    },
  })
  password: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isNotificationEnabled?: boolean;
}
