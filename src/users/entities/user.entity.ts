import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('SYSTEM_USER')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 254, unique: true })
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
