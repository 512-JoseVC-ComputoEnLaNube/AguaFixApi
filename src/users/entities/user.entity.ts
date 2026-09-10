import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('SYSTEM_USER')
@Unique('UQ_SYSTEM_USER_email', ['email'])
export class User {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_SYSTEM_USER' })
  id: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ type: 'varchar', length: 60, select: false })
  password: string;

  @Column({ type: 'boolean', default: true })
  isNotificationEnabled: boolean;
}

export type PublicUser = Omit<User, 'password'>;

export function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isNotificationEnabled: user.isNotificationEnabled,
  };
}
