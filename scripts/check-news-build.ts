import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readdirSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createTestDatabase, projectRoot, testEnvironment } from '../tests/helpers/testDatabase';

const database = createTestDatabase(path.join(projectRoot, 'prisma'));
try {
  for (const name of ['src', 'public', 'prisma.config.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs']) {
    cpSync(path.join(projectRoot, name), path.join(database.directory, name), { recursive: true });
  }
  if (existsSync(path.join(projectRoot, 'next-env.d.ts'))) cpSync(path.join(projectRoot, 'next-env.d.ts'), path.join(database.directory, 'next-env.d.ts'));
  for (const name of ['schema.prisma', 'migrations']) cpSync(path.join(projectRoot, 'prisma', name), path.join(database.directory, 'prisma', name), { recursive: true });
  mkdirSync(path.join(database.directory, 'node_modules'));
  for (const entry of readdirSync(path.join(projectRoot, 'node_modules'), { withFileTypes: true })) {
    const source = path.join(projectRoot, 'node_modules', entry.name);
    const destination = path.join(database.directory, 'node_modules', entry.name);
    if (entry.name === 'geist' || !entry.isDirectory()) cpSync(source, destination, { recursive: true });
    else symlinkSync(source, destination, process.platform === 'win32' ? 'junction' : 'dir');
  }
  const environment: NodeJS.ProcessEnv = { ...testEnvironment(database.databaseUrl), NODE_ENV: 'production' };
  for (const args of [
    [path.join(projectRoot, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    [path.join(projectRoot, 'node_modules/next/dist/bin/next'), 'build', '--webpack'],
  ]) {
    const result = spawnSync(process.execPath, args, { cwd: database.directory, env: environment, encoding: 'utf8', windowsHide: true, timeout: 240_000 });
    console.log(result.stdout);
    console.error(result.stderr);
    assert.equal(result.status, 0, result.error?.message || 'Isolated build command failed');
  }
} finally { database.cleanup(); }