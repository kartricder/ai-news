import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const projectRoot = path.resolve(__dirname, '../..');

export function createTestDatabase(baseDirectory = tmpdir()) {
  const directory = mkdtempSync(path.join(baseDirectory, 'ai-news-test-'));
  const databasePath = path.join(directory, 'news test.db');
  mkdirSync(path.join(directory, 'prisma'));

  return {
    directory,
    databasePath,
    databaseUrl: `file:${databasePath.replaceAll('\\', '/')}`,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

export function testEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { NODE_ENV: 'test' };
  const allowed = /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i;
  for (const [key, value] of Object.entries(process.env)) {
    if (allowed.test(key)) environment[key] = value;
  }
  return {
    ...environment,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    TSX_TSCONFIG_PATH: path.join(projectRoot, 'tsconfig.json'),
    DOTENV_CONFIG_PATH: path.join(tmpdir(), 'ai-news-test-no-dotenv'),
    AI_TRANSLATION_ENABLED: 'false',
    AI_IMPORTANCE_REASON_ENABLED: 'false',
    ALLOW_PUBLISH_WITHOUT_AI: 'false',
    AI_PROCESSING_ENABLED: 'false',
    AI_AUTO_PUBLISH_ENABLED: 'false',
    AI_DAILY_BUDGET_USD: '0',
    PENDING_PROCESSING_ENABLED: 'false',
    NEXT_TELEMETRY_DISABLED: '1',
  };
}

export function runTestProcess(args: string[], databaseUrl: string, cwd = projectRoot) {
  return spawnSync(process.execPath, args, {
    cwd,
    env: testEnvironment(databaseUrl),
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
  });
}

export function runTestCode(code: string, databaseUrl: string, cwd = projectRoot) {
  return runTestProcess([
    '--import',
    pathToFileURL(path.join(projectRoot, 'node_modules/tsx/dist/loader.mjs')).href,
    '--eval',
    `
      const forbidNetwork = () => { throw new Error('Network forbidden in database tests'); };
      globalThis.fetch = forbidNetwork;
      require('node:http').request = forbidNetwork;
      require('node:https').request = forbidNetwork;
      require('node:net').Socket.prototype.connect = forbidNetwork;
      ${code}
    `,
  ], databaseUrl, cwd);
}