import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  const password = randomBytes(12).toString('hex');
  const dto = { name: 'Persona', email: 'PERSON@EXAMPLE.COM', password };
  const repository = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findForLogin: jest.fn(),
  };
  const service = new UsersService(repository as unknown as UsersRepository);

  beforeEach(() => jest.resetAllMocks());

  it('normaliza email, hashea y oculta el password', async () => {
    repository.findByEmail.mockResolvedValue(null);
    repository.create.mockImplementation((data: object) =>
      Promise.resolve({ id: 1, ...data }),
    );
    const result = await service.create(dto);
    expect(result.email).toBe('person@example.com');
    expect(result.isNotificationEnabled).toBe(true);
    expect(result).not.toHaveProperty('password');
    expect(
      await bcrypt.compare(
        password,
        repository.create.mock.calls[0][0].password as string,
      ),
    ).toBe(true);
  });

  it('respeta preferencia false', async () => {
    repository.create.mockImplementation((data: object) =>
      Promise.resolve({ id: 1, ...data }),
    );
    expect(
      (await service.create({ ...dto, isNotificationEnabled: false }))
        .isNotificationEnabled,
    ).toBe(false);
  });

  it('rechaza duplicado antes de guardar', async () => {
    repository.findByEmail.mockResolvedValue({ id: 1 });
    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('traduce la colisión concurrente del índice único a 409', async () => {
    repository.create.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate'), { code: '23505' }),
      ),
    );
    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
  });
});
