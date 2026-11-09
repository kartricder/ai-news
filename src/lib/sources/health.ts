import { prisma } from '../prisma';
import type { SourceProbeResult } from './catalog';

export async function recordSourceResult(sourceId: string, result: SourceProbeResult, runId?: string, probe = false, expected?: { url: string; configJson: string }): Promise<boolean> {
  const attemptedAt = new Date(result.fetchedAt);
  return prisma.$transaction(async (transaction) => {
    const source = await transaction.source.findUniqueOrThrow({ where: { id: sourceId } });
    if (expected && (expected.url !== source.url || expected.configJson !== source.configJson)) return false;
    const failure = result.status === 'failed';
    const failures = failure ? source.consecutiveFailures + 1 : 0;
    const delay = Math.min(86_400_000, Math.max([15, 60, 360][Math.min(2, failures - 1)] * 60_000 || 0, result.retryAfterMs || 0));
    const success = result.status === 'ok' || result.status === 'not_modified';
    await transaction.source.update({ where: { id: sourceId }, data: {
      lastAttemptAt: attemptedAt,
      ...(success ? { lastSuccessAt: attemptedAt, lastError: '', consecutiveFailures: 0,
        nextAttemptAt: null } : {}),
      ...(failure ? { lastError: result.errorCode || 'unknown-error', consecutiveFailures: { increment: 1 }, nextAttemptAt: new Date(attemptedAt.getTime() + delay) } : {}),
      ...(probe ? { verificationStatus: result.verificationStatus, verifiedAt: result.verificationStatus === 'verified' ? attemptedAt : null } : {}),
    } });
    await transaction.sourceFetchLog.create({ data: {
      sourceId, runId, status: result.status, fetchedCount: result.items.length, durationMs: result.durationMs,
      httpStatus: result.httpStatus, errorCode: result.errorCode || (result.stale && result.status === 'ok' ? 'stale-feed' : undefined), fetchedAt: attemptedAt,
    } });
    return true;
  });
}

export async function checkpointSourceValidators(source: { id: string; url: string; configJson: string }, result: SourceProbeResult): Promise<void> {
  if (result.status !== 'ok') return;
  await prisma.source.updateMany({ where: { id: source.id, url: source.url, configJson: source.configJson },
    data: { etag: result.etag || null, lastModified: result.lastModified || null } });
}