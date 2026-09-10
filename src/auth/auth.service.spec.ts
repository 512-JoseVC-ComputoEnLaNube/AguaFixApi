import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  const password = randomBytes(12).toString('hex');
  const users = { findForLogin: jest.fn() };
  const service = new AuthService(users as unknown as UsersService);

  it('devuelve usuario sin hash para credenciales válidas', async () => {
    users.findForLogin.mockResolvedValue({
      id: 1,
      name: 'Persona',
      email: 'person@example.com',
      password: await bcrypt.hash(password, 4),
      isNotificationEnabled: true,
    });
    const result = await service.login({
      email: 'person@example.com',
      password,
    });
    expect(result.message).toBe('Inicio de sesión exitoso');
    expect(result.user).not.toHaveProperty('password');
  });

  it('rechaza contraseña incorrecta con el mensaje requerido', async () => {
    users.findForLogin.mockResolvedValue({
      password: await bcrypt.hash(password, 4),
    });
    await expect(
      service.login({
        email: 'person@example.com',
        password: randomBytes(10).toString('hex'),
      }),
    ).rejects.toThrow('Correo o contraseña incorrectos');
  });

  it('usa BadRequestException para un correo inexistente', async () => {
    users.findForLogin.mockResolvedValue(null);
    await expect(
      service.login({ email: 'person@example.com', password }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
