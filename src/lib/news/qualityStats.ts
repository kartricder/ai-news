import { prisma } from '../prisma';
import { getAiConfiguration } from '../ai/budget';

export async function getQualityStats() {
  const day = new Date().toISOString().slice(0, 10);
  const [budget, unknown, unsettled, backlog, oldest, review, modelErrors, sourceErrors, coverage, configuration] = await Promise.all([
    prisma.aiBudgetDay.findUnique({ where: { day } }),
    prisma.aiReservation.count({ where: { day, status: 'unknown' } }),
    prisma.aiReservation.count({ where: { day, status: 'reserved' } }),
    prisma.article.groupBy({ by: ['processingStatus'], where: { status: 'pending' }, _count: { id: true } }),
    prisma.article.findFirst({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.article.count({ where: { status: 'pending', OR: [{ processingStatus: 'review' }, { qualityFlags: { not: '[]' } }] } }),
    prisma.aiAttempt.groupBy({ by: ['model', 'errorCode'], where: { status: 'failed' }, _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 20 }),
    prisma.source.findMany({ where: { consecutiveFailures: { gt: 0 } }, select: { id: true, name: true, kind: true, lastError: true, consecutiveFailures: true }, take: 30, orderBy: { consecutiveFailures: 'desc' } }),
    prisma.article.groupBy({ by: ['sourceKind', 'status'], _count: { id: true } }),
    getAiConfiguration(),
  ]);
  return {
    day, dailyBudgetUsd: configuration.dailyBudgetUsd, knownUsd: Number(budget?.spentMicros || BigInt(0)) / 1_000_000,
    reservedUsd: Number(budget?.reservedMicros || BigInt(0)) / 1_000_000, unknownAttempts: unknown, unsettledAttempts: unsettled,
    backlog: backlog.map((entry) => ({ status: entry.processingStatus, count: entry._count.id })), review,
    oldestPendingAt: oldest?.createdAt.toISOString() || null,
    oldestPendingHours: oldest ? Math.max(0, Math.floor((Date.now() - oldest.createdAt.getTime()) / 3_600_000)) : 0,
    modelErrors: modelErrors.map((entry) => ({ model: entry.model, code: entry.errorCode, count: entry._count.id })), sourceErrors,
    coverage: coverage.map((entry) => ({ kind: entry.sourceKind, status: entry.status, count: entry._count.id })),
  };
}