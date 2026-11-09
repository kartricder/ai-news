import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { resolveSqliteUrl } from '../../src/lib/databaseUrl';
import { createTestDatabase, projectRoot, runTestCode, runTestProcess } from '../helpers/testDatabase';
import { sourceCatalog } from '../../src/lib/sources/catalog';

const legacyNames = ['OpenAI Blog', 'Anthropic Blog', 'Google AI Blog', 'DeepMind Blog', 'Meta AI Blog', 'HuggingFace Blog', 'VentureBeat AI', 'MIT Technology Review AI', 'GitHub Trending', 'Hacker News', 'Reddit r/LocalLLaMA', 'Reddit r/MachineLearning', 'Reddit r/OpenAI'];
const expectedSourceNames = [...new Set([...legacyNames, ...sourceCatalog.map((entry) => entry.name)])];

const pathCases: [string, string | undefined, string, string][] = [
  ['default', undefined, 'D:\\apps\\news', 'file:D:/apps/news/prisma/dev.db'],
  ['project-relative', 'file:./prisma/test.db', 'D:\\apps\\news', 'file:D:/apps/news/prisma/test.db'],
  ['relative parent segments', 'file:./sandbox/../test.db', 'D:\\apps\\news', 'file:D:/apps/news/test.db'],
  ['Windows absolute', 'file:C:/data/news.db', 'D:\\apps\\news', 'file:C:/data/news.db'],
  ['Windows backslashes', 'file:C:\\data\\news.db', 'D:\\apps\\news', 'file:C:/data/news.db'],
  ['Windows file URL', 'file:///C:/data/news.db', 'D:\\apps\\news', 'file:C:/data/news.db'],
  ['spaces', 'file:./data/news test.db', 'D:\\apps\\news', 'file:D:/apps/news/data/news test.db'],
  ['POSIX default', undefined, '/app', 'file:/app/prisma/dev.db'],
  ['POSIX absolute', 'file:/tmp/test.db', '/app', 'file:/tmp/test.db'],
  ['POSIX file URL', 'file:///tmp/test.db', '/app', 'file:/tmp/test.db'],
];

for (const [name, configured, root, expected] of pathCases) {
  test(`resolveSqliteUrl: ${name}`, () => {
    assert.equal(resolveSqliteUrl(configured, root), expected);
  });
}

test('legacy URL maps explicitly to prisma/dev.db with a migration warning', (context) => {
  const warning = context.mock.method(console, 'warn', () => undefined);
  assert.equal(resolveSqliteUrl('file:./dev.db', 'D:\\apps\\news'), 'file:D:/apps/news/prisma/dev.db');
  assert.equal(warning.mock.callCount(), 1);
  assert.match(warning.mock.calls[0].arguments[0], /Legacy.*file:\.\/dev\.db.*file:\.\/prisma\/dev\.db/);
});

test('invalid or ambiguous database configuration fails closed', () => {
  for (const configured of ['', 'file:', 'postgresql://example.invalid/db', 'file:C:relative.db', 'file://server/share/db', 'file:./test.db?mode=ro', 'file:./test.db#fragment']) {
    assert.throws(() => resolveSqliteUrl(configured, projectRoot), /DATABASE_URL/);
  }
});

test('runtime honors DATABASE_URL without using the default database', () => {
  const database = createTestDatabase();
  try {
    const result = runTestCode(`
      const { prisma } = require(${JSON.stringify(path.join(projectRoot, 'src/lib/prisma.ts'))});
      (async () => {
        try {
          const databases = await prisma.$queryRawUnsafe('PRAGMA database_list');
          console.log(JSON.stringify(databases.map(row => ({ name: row.name, file: row.file }))));
        } finally {
          await prisma.$disconnect();
        }
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `, database.databaseUrl, database.directory);
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const databases = JSON.parse(result.stdout.trim());
    assert.equal(path.resolve(databases.find((row: { name: string }) => row.name === 'main').file), database.databasePath);
    assert.equal(existsSync(path.join(database.directory, 'prisma/dev.db')), false);
  } finally {
    database.cleanup();
  }
});

for (const mode of ['absolute', 'relative'] as const) {
  test(`Prisma CLI, runtime and repeated seed share an isolated ${mode} database`, () => {
    const database = createTestDatabase(mode === 'relative' ? path.join(projectRoot, 'prisma') : undefined);
    try {
      const databaseUrl = mode === 'absolute'
        ? database.databaseUrl
        : `file:./${path.relative(projectRoot, database.databasePath).replaceAll('\\', '/')}`;
      const cli = path.join(projectRoot, 'node_modules/prisma/build/index.js');
      const runtime = JSON.stringify(path.join(projectRoot, 'src/lib/prisma.ts'));
      const migration = runTestProcess([cli, 'migrate', 'deploy'], databaseUrl);
      assert.equal(migration.status, 0, migration.stderr || migration.error?.message);
      assert.equal(existsSync(database.databasePath), true);

      const prepare = runTestCode(`
        const assert = require('node:assert/strict');
        const { prisma } = require(${runtime});
        (async () => {
          try {
            assert.equal(await prisma.source.count(), 0);
            await prisma.source.create({ data: {
              id: 'preserved-source', name: 'OpenAI Blog', type: 'custom', enabled: false,
              url: 'https://fixture.invalid/admin-feed.xml', configJson: '{"maxItems":7}'
            } });
            await prisma.appSetting.createMany({ data: [
              { key: 'publish_threshold', value: '91' },
              { key: 'pending_threshold', value: '66' },
              { key: 'ai_translation_enabled', value: 'false' },
              { key: 'ai_importance_reason_enabled', value: 'false' },
              { key: 'allow_publish_without_ai', value: 'false' }
            ] });
            await prisma.article.create({ data: {
              id: 'preserved-article', title: 'Fixture title', slug: 'preserved-slug', summaryVi: 'Fixture',
              sourceName: 'OpenAI Blog', sourceUrl: 'https://fixture.invalid/feed.xml',
              originalUrl: 'https://fixture.invalid/article', status: 'published'
            } });
          } finally { await prisma.$disconnect(); }
        })().catch(error => { console.error(error); process.exitCode = 1; });
      `, databaseUrl);
      assert.equal(prepare.status, 0, prepare.stderr || prepare.error?.message);

      for (let attempt = 0; attempt < 2; attempt++) {
        const seeded = runTestProcess([cli, 'db', 'seed'], databaseUrl);
        assert.equal(seeded.status, 0, seeded.stderr || seeded.error?.message);
      }

      const directSeed = runTestCode(`require(${JSON.stringify(path.join(projectRoot, 'prisma/seed.ts'))});`, database.databaseUrl, database.directory);
      assert.equal(directSeed.status, 0, directSeed.stderr || directSeed.error?.message);

      const verify = runTestCode(`
        const assert = require('node:assert/strict');
        const path = require('node:path');
        const { prisma } = require(${runtime});
        (async () => {
          try {
            const databases = await prisma.$queryRawUnsafe('PRAGMA database_list');
            assert.equal(path.resolve(databases.find(row => row.name === 'main').file), ${JSON.stringify(database.databasePath)});
            const migrations = await prisma.$queryRawUnsafe('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL');
            assert.deepEqual(migrations.map(row => row.migration_name).sort(), ${JSON.stringify(readdirSync(path.join(projectRoot, 'prisma/migrations')).filter((name) => existsSync(path.join(projectRoot, 'prisma/migrations', name, 'migration.sql'))).sort())});
            assert.deepEqual((await prisma.source.findMany({ select: { name: true } })).map(row => row.name).sort(), ${JSON.stringify(expectedSourceNames.sort())});
            assert.equal(await prisma.source.count({ where: { enabled: true } }), 0);
            assert.equal(await prisma.article.count(), 1);
            assert.equal(await prisma.telegramLog.count(), 0);
            const source = await prisma.source.findUniqueOrThrow({ where: { id: 'preserved-source' } });
            assert.equal(source.enabled, false);
            assert.equal(source.type, 'custom');
            assert.equal(source.url, 'https://fixture.invalid/admin-feed.xml');
            assert.equal(source.configJson, '{"maxItems":7}');
            assert.equal((await prisma.article.findUniqueOrThrow({ where: { id: 'preserved-article' } })).slug, 'preserved-slug');
            for (const [key, value] of [['publish_threshold', '91'], ['pending_threshold', '66'], ['ai_translation_enabled', 'false'], ['ai_importance_reason_enabled', 'false'], ['allow_publish_without_ai', 'false']]) {
              assert.equal((await prisma.appSetting.findUniqueOrThrow({ where: { key } })).value, value);
            }
          } finally { await prisma.$disconnect(); }
        })().catch(error => { console.error(error); process.exitCode = 1; });
      `, databaseUrl);
      assert.equal(verify.status, 0, verify.stderr || verify.error?.message);
      const diagnostic = runTestCode(`
        const { RSSCrawler } = require(${JSON.stringify(path.join(projectRoot, 'src/crawlers/RSSCrawler.ts'))});
        const { RedditCrawler } = require(${JSON.stringify(path.join(projectRoot, 'src/crawlers/RedditCrawler.ts'))});
        RSSCrawler.prototype.fetch = async () => [];
        RedditCrawler.prototype.fetch = async () => [];
        require(${JSON.stringify(path.join(projectRoot, 'scripts/crawl-direct.ts'))});
      `, database.databaseUrl, database.directory);
      assert.equal(diagnostic.status, 0, diagnostic.stderr || diagnostic.error?.message);
      assert.match(diagnostic.stdout, new RegExp('DB Sources \\(' + expectedSourceNames.length + '\\)'));
      assert.equal(existsSync(path.join(database.directory, 'prisma/dev.db')), false);
    } finally {
      database.cleanup();
    }
  });
}