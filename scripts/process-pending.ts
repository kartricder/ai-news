import 'dotenv/config';
import { parseArgs } from 'node:util';
import { processPendingArticles } from '../src/lib/pipeline/processPending';
import { prisma } from '../src/lib/prisma';

async function main() {
  const { values } = parseArgs({ options: { limit: { type: 'string', default: '10' }, 'dry-run': { type: 'boolean', default: false } }, strict: true });
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 0 || limit > 10) throw new Error('limit must be an integer from 0 to 10');
  try { console.log(JSON.stringify(await processPendingArticles({ limit, dryRun: values['dry-run'] }), null, 2)); }
  finally { await prisma.$disconnect(); }
}
void main().catch(() => { console.error('Pending processing failed; inspect admin traces and verify database migrations/configuration.'); process.exitCode = 1; });