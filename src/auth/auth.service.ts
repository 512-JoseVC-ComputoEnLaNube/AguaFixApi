import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { publicUser } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  register(dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findForLogin(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new BadRequestException('Correo o contraseña incorrectos');
    }
    return { message: 'Inicio de sesión exitoso', user: publicUser(user) };
  }
}
