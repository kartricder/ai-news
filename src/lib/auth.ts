import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getAdminCredentials() {
  const usernameSetting = await prisma.appSetting.findUnique({ where: { key: 'admin_username' } });
  const passwordSetting = await prisma.appSetting.findUnique({ where: { key: 'admin_password_hashed' } });

  return {
    username: usernameSetting?.value || 'admin',
    passwordHash: passwordSetting?.value || '',
  };
}

export async function ensureAdminUser() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existingUsername = await prisma.appSetting.findUnique({ where: { key: 'admin_username' } });
  if (!existingUsername) {
    await prisma.appSetting.create({ data: { key: 'admin_username', value: username } });
  }

  const existingHash = await prisma.appSetting.findUnique({ where: { key: 'admin_password_hashed' } });
  if (!existingHash || !existingHash.value) {
    const hashed = await hashPassword(password);
    await prisma.appSetting.upsert({
      where: { key: 'admin_password_hashed' },
      update: { value: hashed },
      create: { key: 'admin_password_hashed', value: hashed, encrypted: true },
    });
  }
}
