import 'dotenv/config';
import { parseArgs } from 'node:util';
import { sourceCatalog, catalogConfig, toSourceConfig } from '../src/lib/sources/catalog';
import { probeSource } from '../src/lib/sources/reader';

async function main() {
  const { values } = parseArgs({ options: { 'catalog-id': { type: 'string' }, all: { type: 'boolean' }, 'dry-run': { type: 'boolean', default: false } }, strict: true });
  if (Boolean(values.all) === Boolean(values['catalog-id'])) throw new Error('Choose exactly --all or --catalog-id ID');
  const entries = sourceCatalog.filter((entry) => values.all || entry.catalogId === values['catalog-id']);
  if (!entries.length) throw new Error('Unknown catalog ID');
  const client = values['dry-run'] ? null : (await import('../src/lib/prisma')).prisma;
  try {
    for (const entry of entries) {
      const stored = client ? await client.source.findUnique({ where: { catalogId: entry.catalogId } }) : null;
      if (client && !stored) throw new Error('Import catalog before a persisted probe');
      const result = await probeSource(stored ? toSourceConfig(stored) : catalogConfig(entry));
      if (client && stored) {
        const recorded = await (await import('../src/lib/sources/health')).recordSourceResult(stored.id, result, undefined, true, stored);
        if (!recorded) throw new Error('Source configuration changed while probing; retry');
      }
      const { items, ...report } = result;
      console.log(JSON.stringify({ catalogId: entry.catalogId, checkedAt: result.fetchedAt, discoveryUrl: entry.discoveryUrl, itemCount: items.length, ...report }));
      if (result.status === 'failed') process.exitCode = 1;
    }
  } finally { await client?.$disconnect(); }
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Source probe failed'); process.exitCode = 1; });