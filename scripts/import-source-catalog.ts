import 'dotenv/config';
import { parseArgs } from 'node:util';
import path from 'node:path';
import Database from 'better-sqlite3';
import { resolveSqliteUrl } from '../src/lib/databaseUrl';
import { sourceCatalog } from '../src/lib/sources/catalog';
import { importSourceCatalog } from '../src/lib/sources/importCatalog';

async function main() {
  const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } }, strict: true });
  if (values['dry-run']) {
    const url = resolveSqliteUrl(process.env.DATABASE_URL, path.resolve(__dirname, '..'));
    const database = new Database(url.slice(5), { readonly: true, fileMustExist: true });
    try {
      const columns = database.pragma('table_info(Source)') as { name: string }[];
      const sources = database.prepare(`SELECT id, name, url, ${columns.some((column) => column.name === 'catalogId') ? 'catalogId' : 'NULL AS catalogId'} FROM Source`).all() as { id: string; name: string; url: string; catalogId: string | null }[];
      console.log(JSON.stringify({ dryRun: true, sources: sourceCatalog.map((entry) => {
        const existing = sources.find((source) => source.catalogId === entry.catalogId || source.name === entry.name || source.url === entry.url);
        return { catalogId: entry.catalogId, sourceId: existing?.id, action: existing ? existing.catalogId ? 'preserved' : 'attach-metadata-only' : 'create-disabled-unverified' };
      }) }, null, 2));
    } finally { database.close(); }
    return;
  }
  const { prisma } = await import('../src/lib/prisma');
  try { console.log(JSON.stringify({ dryRun: false, sources: await importSourceCatalog(prisma) }, null, 2)); }
  finally { await prisma.$disconnect(); }
}
void main().catch(() => { console.error('Catalog import failed; verify migration and DATABASE_URL.'); process.exitCode = 1; });