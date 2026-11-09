import 'dotenv/config';
import { runPendingCronTick } from '../src/lib/pipeline/pendingCron';
import { prisma } from '../src/lib/prisma';

void runPendingCronTick().then((result) => console.log('[cron:pending]', result))
  .catch(() => { console.error('[cron:pending] failed; verify migrations and admin configuration'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());