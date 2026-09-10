import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReportDto } from '../reports/dto/create-report.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { createValidationPipe } from './validation';

describe('Validación de entradas', () => {
  const report = {
    address: ' Calle 1 ',
    description: 'Fuga continua',
    severity: 'high',
    reporterPhone: '+52 (477) 123-4567',
  };
  it('acepta teléfono mexicano y normaliza espacios', async () => {
    const dto = plainToInstance(CreateReportDto, report);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.address).toBe('Calle 1');
  });
  it.each([
    { severity: 'urgent' },
    { address: '   ' },
    { reporterPhone: '123' },
    { description: '' },
  ])('rechaza reporte inválido: %j', async (change) => {
    expect(
      (
        await validate(
          plainToInstance(CreateReportDto, { ...report, ...change }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it.each(['id', 'isResolved', 'createdAt'])(
    'rechaza campo administrado por servidor: %s',
    async (key) => {
      await expect(
        createValidationPipe().transform(
          { ...report, [key]: 'forbidden' },
          { type: 'body', metatype: CreateReportDto },
        ),
      ).rejects.toThrow();
    },
  );
  it('rechaza null como preferencia y contraseñas que excedan 72 bytes', async () => {
    const dto = plainToInstance(CreateUserDto, {
      name: 'Persona',
      email: 'person@example.com',
      password: 'á'.repeat(40),
      isNotificationEnabled: null,
    });
    const fields = (await validate(dto)).map((error) => error.property);
    expect(fields).toEqual(
      expect.arrayContaining(['password', 'isNotificationEnabled']),
    );
  });
});
