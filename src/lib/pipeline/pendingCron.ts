import cron from 'node-cron';
import { getSetting } from '../settings';
import { prisma } from '../prisma';
import { processPendingArticles } from './processPending';

export async function runPendingCronTick() {
  const [enabled, schedule, configuredLimit] = await Promise.all([
    getSetting('pending_processing_enabled'), getSetting('pending_cron_schedule'), getSetting('pending_process_limit'),
  ]);
  if ((enabled ?? process.env.PENDING_PROCESSING_ENABLED) !== 'true') return { skipped: 'pending-cron-disabled' };
  const expression = schedule ?? process.env.PENDING_CRON_SCHEDULE ?? '*/15 * * * *';
  if (!cron.validate(expression) || expression.trim().split(/\s+/).length !== 5) return { skipped: 'invalid-pending-schedule' };
  const limit = Number(configuredLimit ?? process.env.PENDING_PROCESS_LIMIT ?? '10');
  if (!Number.isInteger(limit) || limit < 0 || limit > 10) return { skipped: 'invalid-pending-limit' };
  const scheduleTask = cron.createTask(expression, () => {}, { timezone: 'UTC' });
  let next: Date | null;
  try { scheduleTask.start(); next = scheduleTask.getNextRun(); }
  finally { scheduleTask.destroy(); }
  if (!next) return { skipped: 'no-next-pending-run' };
  const now = new Date();
  const due = await prisma.$transaction(async (transaction) => {
    const state = await transaction.workerLease.upsert({ where: { name: 'pending-cron-schedule' },
      create: { name: 'pending-cron-schedule', owner: expression, leaseUntil: now }, update: {} });
    if (state.owner !== expression) {
      await transaction.workerLease.update({ where: { name: state.name }, data: { owner: expression, leaseUntil: next } });
      return false;
    }
    const changed = await transaction.workerLease.updateMany({ where: { name: state.name, owner: expression, leaseUntil: { lte: now } }, data: { leaseUntil: next } });
    return changed.count > 0;
  });
  if (!due) return { skipped: 'pending-not-due' };
  return processPendingArticles({ limit, dryRun: false });
}