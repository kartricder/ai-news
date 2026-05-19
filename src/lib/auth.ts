import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
export const AUTH_COOKIE_NAME = 'auth_token';

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

export function isDefaultAdminPassword(password: string | undefined): boolean {
  return !password || password === 'admin123';
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 24 * 60 * 60,
  };
}

export async function validateAdminCredentials(username: string, password: string): Promise<boolean> {
  const envUsername = process.env.ADMIN_USERNAME;
  const envPassword = process.env.ADMIN_PASSWORD;

  if (process.env.NODE_ENV === 'production' && isDefaultAdminPassword(envPassword)) {
    console.warn('[Auth] ADMIN_PASSWORD is not set. Admin login is disabled in production.');
    return false;
  }

  if (envUsername && envPassword) {
    return username === envUsername && password === envPassword;
  }

  const credentials = await getAdminCredentials();
  if (username !== credentials.username || !credentials.passwordHash) {
    return false;
  }
  return verifyPassword(password, credentials.passwordHash);
}

export async function ensureAdminUser() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'admin123');

  const existingUsername = await prisma.appSetting.findUnique({ where: { key: 'admin_username' } });
  if (!existingUsername) {
    await prisma.appSetting.create({ data: { key: 'admin_username', value: username } });
  }

  const existingHash = await prisma.appSetting.findUnique({ where: { key: 'admin_password_hashed' } });
  if ((!existingHash || !existingHash.value) && password) {
    const hashed = await hashPassword(password);
    await prisma.appSetting.upsert({
      where: { key: 'admin_password_hashed' },
      update: { value: hashed },
      create: { key: 'admin_password_hashed', value: hashed, encrypted: true },
    });
  }
}
