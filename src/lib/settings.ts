import { prisma } from './prisma';
import { decrypt } from './crypto';
import { AppSettings } from '@/types';

export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  if (!setting) return null;
  if (setting.encrypted) {
    return decrypt(setting.value);
  }
  return setting.value;
}

export async function setSetting(key: string, value: string, encrypted = false): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value, encrypted },
    create: { key, value, encrypted },
  });
}

export async function getAppSettings(): Promise<AppSettings> {
  const [
    publishThreshold,
    pendingThreshold,
    cronSchedule,
    adminUsername,
    telegramBotToken,
    telegramChatId,
  ] = await Promise.all([
    getSetting('publish_threshold'),
    getSetting('pending_threshold'),
    getSetting('cron_schedule'),
    getSetting('admin_username'),
    getSetting('telegram_bot_token'),
    getSetting('telegram_chat_id'),
  ]);

  return {
    publish_threshold: parseInt(publishThreshold || '75', 10),
    pending_threshold: parseInt(pendingThreshold || '60', 10),
    cron_schedule: cronSchedule || '0 6 * * *',
    admin_username: adminUsername || 'admin',
    telegram_bot_token: telegramBotToken || '',
    telegram_chat_id: telegramChatId || '',
  };
}
