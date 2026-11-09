import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveSqliteUrl } from '../src/lib/databaseUrl';
import { getIdentityKey } from '../src/lib/news/identity';

type LegacyArticle = {
  id: string;
  originalUrl: string;
  sourceId?: string | null;
  externalId?: string | null;
  identityKey?: string | null;
  duplicateOfId: string | null;
  status: string;
  slug: string;
};

const migrationName = '20261030090000_news_identity';

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing ${name}. Use --source <db> --copy <new-db> --report <new-report.json>.`);
  return value;
}

async function main() {
  const sourcePath = realpathSync(path.resolve(argument('--source')));
  const copyPath = path.resolve(argument('--copy'));
  const reportPath = path.resolve(argument('--report'));
  const root = path.resolve(__dirname, '..');
  const forbidden = [sourcePath, path.join(root, 'prisma/dev.db'), path.join(root, 'dev.db')];
  if (forbidden.some((file) => file.toLowerCase() === copyPath.toLowerCase()) || copyPath === reportPath) {
    throw new Error('Copy/report must be new paths, distinct from source and application databases.');
  }
  if (existsSync(copyPath) || existsSync(reportPath)) throw new Error('Copy/report already exists; refusing to overwrite.');
  mkdirSync(path.dirname(copyPath), { recursive: true });
  mkdirSync(path.dirname(reportPath), { recursive: true });
  closeSync(openSync(copyPath, 'wx'));

  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(copyPath);
  } finally {
    source.close();
  }

  const database = new Database(copyPath, { fileMustExist: true });
  try {
    const articles = database.prepare('SELECT * FROM Article ORDER BY createdAt, id').all() as LegacyArticle[];
    if (articles.some((article) => article.identityKey)) throw new Error('Snapshot already has identities; reconcile manually instead of replacing existing ownership.');

    const groups = new Map<string, LegacyArticle[]>();
    const unidentified: string[] = [];
    for (const article of articles) {
      const identity = getIdentityKey({
        sourceId: article.sourceId || '',
        externalId: article.externalId || undefined,
        articleUrl: article.originalUrl,
        sourceUrl: '', title: '', text: '', publishedAt: null, fetchedAt: '', language: null, evidenceLevel: 'title_only',
      });
      if (!identity) {
        unidentified.push(article.id);
        continue;
      }
      const group = groups.get(identity) || [];
      group.push(article);
      groups.set(identity, group);
    }

    const ownership = [...groups].map(([identityKey, group]) => {
      const owner = group.find((article) => article.status === 'published' && !article.duplicateOfId)
        || group.find((article) => !article.duplicateOfId) || group[0];
      return { identityKey, owner, duplicates: group.filter((article) => article.id !== owner.id) };
    });
    const report = {
      generatedAt: new Date().toISOString(),
      sourcePath,
      copyPath,
      totalArticles: articles.length,
      identities: ownership.length,
      unidentifiedArticleIds: unidentified,
      collisions: ownership.filter((entry) => entry.duplicates.length).map((entry) => ({
        identityKey: entry.identityKey,
        ownerId: entry.owner.id,
        duplicateIds: entry.duplicates.map((article) => article.id),
      })),
      fingerprintPolicy: 'Legacy original text is unavailable; leave fingerprint empty and require review on next observation.',
      state: 'collision-report-before-backfill-and-unique-index',
    };
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });

    const columns = new Set((database.prepare('PRAGMA table_info(Article)').all() as { name: string }[]).map((column) => column.name));
    const migration = readFileSync(path.join(root, 'prisma/migrations', migrationName, 'migration.sql'), 'utf8');
    const statements = migration.split(';').map((statement) => statement.trim()).filter(Boolean);
    const migrationRecorded = database.prepare('SELECT id FROM _prisma_migrations WHERE migration_name = ? AND rolled_back_at IS NULL').get(migrationName);
    const before = articles.map((article) => [article.id, article.slug, article.status]);

    database.transaction(() => {
      for (const statement of statements) {
        const columnName = statement.match(/ADD COLUMN "([^"]+)"/)?.[1];
        if (columnName && !columns.has(columnName)) database.exec(`${statement};`);
      }
      const assignOwner = database.prepare("UPDATE Article SET identityKey = ?, identityReviewReason = CASE WHEN fingerprint = '' THEN 'legacy-fingerprint-unavailable' ELSE identityReviewReason END WHERE id = ?");
      const linkDuplicate = database.prepare("UPDATE Article SET identityKey = NULL, duplicateOfId = ?, duplicateReason = 'same-article-identity' WHERE id = ? AND duplicateOfId IS NULL");
      for (const entry of ownership) {
        assignOwner.run(entry.identityKey, entry.owner.id);
        for (const duplicate of entry.duplicates) linkDuplicate.run(entry.owner.id, duplicate.id);
      }
      database.exec('CREATE UNIQUE INDEX IF NOT EXISTS "Article_identityKey_key" ON "Article"("identityKey");');
      if (!migrationRecorded) {
        const now = new Date().toISOString();
        database.prepare('INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)')
          .run(randomUUID(), createHash('sha256').update(migration).digest('hex'), now, migrationName, now);
      }
      const after = (database.prepare('SELECT id, slug, status FROM Article ORDER BY createdAt, id').all() as LegacyArticle[])
        .map((article) => [article.id, article.slug, article.status]);
      if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Snapshot article IDs, slugs or statuses changed; rolling back.');
    })();

    console.log(JSON.stringify({ copyPath, reportPath, identities: ownership.length, collisionGroups: report.collisions.length, unidentified: unidentified.length, state: 'prepared-copy-only' }, null, 2));
    console.log(`Snapshot DATABASE_URL: ${resolveSqliteUrl(`file:${copyPath}`, root)}`);
  } finally {
    database.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});