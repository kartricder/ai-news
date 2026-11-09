import type { PrismaClient } from '@prisma/client';
import { sourceCatalog } from './catalog';

export async function importSourceCatalog(client: PrismaClient, dryRun = false) {
  const changes: { catalogId: string; action: string; sourceId?: string }[] = [];
  for (const entry of sourceCatalog) {
    await client.$transaction(async (transaction) => {
      const existing = await transaction.source.findFirst({ where: { OR: [{ catalogId: entry.catalogId }, { name: entry.name }, { url: entry.url }] } });
      if (existing) {
        changes.push({ catalogId: entry.catalogId, sourceId: existing.id, action: existing.catalogId ? 'preserved' : 'attach-metadata-only' });
        if (!dryRun && !existing.catalogId) await transaction.source.update({ where: { id: existing.id }, data: {
          catalogId: entry.catalogId, publisherKey: existing.publisherKey || entry.publisherKey, kind: existing.kind || entry.kind,
          language: existing.language || entry.language, discoveryUrl: existing.discoveryUrl || entry.discoveryUrl,
        } });
      } else {
        changes.push({ catalogId: entry.catalogId, action: 'create-disabled-unverified' });
        if (!dryRun) await transaction.source.create({ data: {
          catalogId: entry.catalogId, name: entry.name, type: entry.type, url: entry.url, enabled: false,
          publisherKey: entry.publisherKey, kind: entry.kind, language: entry.language, discoveryUrl: entry.discoveryUrl,
          configJson: JSON.stringify({ intervalMinutes: entry.intervalMinutes, maxItems: entry.maxItems, timeoutMs: 10_000, filterAI: entry.filterAI }),
        } });
      }
    });
  }
  return changes;
}