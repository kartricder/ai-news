import path from 'node:path';

export function resolveSqliteUrl(value: string | undefined, projectRoot: string): string {
  const configured = value === undefined ? 'file:./prisma/dev.db' : value.trim();
  if (!configured.startsWith('file:') || configured.length === 5) {
    throw new Error('DATABASE_URL must be a non-empty SQLite file: URL.');
  }

  let databasePath = configured.slice(5).replaceAll('\\', '/');
  if (databasePath === './dev.db') {
    console.warn('[database] Legacy DATABASE_URL=file:./dev.db maps to prisma/dev.db; migrate the configuration to file:./prisma/dev.db.');
    databasePath = './prisma/dev.db';
  }
  if (databasePath.startsWith('///')) {
    databasePath = databasePath.slice(2);
    if (/^\/[a-z]:\//i.test(databasePath)) databasePath = databasePath.slice(1);
  }
  if (databasePath.startsWith('//') || /[?#]/.test(databasePath) || /^[a-z]:(?!\/)/i.test(databasePath)) {
    throw new Error('DATABASE_URL must use a local file path without query or fragment.');
  }

  const pathApi = /^[a-z]:\//i.test(databasePath) || /^[a-z]:[\\/]/i.test(projectRoot) ? path.win32 : path.posix;
  const absolutePath = pathApi.resolve(projectRoot, databasePath).replaceAll('\\', '/');
  return `file:${absolutePath}`;
}