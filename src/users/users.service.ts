import { ConflictException, Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { PublicUser, publicUser } from './entities/user.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();
    if (await this.usersRepository.findByEmail(email)) {
      throw new ConflictException('El correo ya está registrado');
    }
    const password = await bcrypt.hash(dto.password, 12);
    try {
      const user = await this.usersRepository.create({
        name: dto.name,
        email,
        password,
        isNotificationEnabled: dto.isNotificationEnabled ?? true,
      });
      return publicUser(user);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('El correo ya está registrado');
      }
      throw error;
    }
  }

  findForLogin(email: string) {
    return this.usersRepository.findForLogin(email.trim().toLowerCase());
  }
}
