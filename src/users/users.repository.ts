import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User) private readonly repository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }

  findForLogin(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  create(
    data: Pick<User, 'name' | 'email' | 'password'> &
      Partial<Pick<User, 'isNotificationEnabled'>>,
  ): Promise<User> {
    return this.repository.save(this.repository.create(data));
  }
}
