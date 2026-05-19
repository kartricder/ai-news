import { prisma } from './prisma';
import { decrypt, encrypt } from './crypto';
import { AppSettings } from '@/types';

function envString(key: string, fallback = ''): string {
  return process.env[key] || fallback;
}

function parseIntSetting(value: string | null, envKey: string, fallback: number): number {
  const raw = value || process.env[envKey] || String(fallback);
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolSetting(value: string | null, envKey: string, fallback: boolean): boolean {
  const raw = (value || process.env[envKey] || String(fallback)).toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  if (!setting) return null;
  if (setting.encrypted) {
    if (!setting.value) return '';
    return decrypt(setting.value);
  }
  return setting.value;
}

export async function setSetting(key: string, value: string, encrypted = false): Promise<void> {
  const storedValue = encrypted && value ? encrypt(value) : value;
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: storedValue, encrypted },
    create: { key, value: storedValue, encrypted },
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
    appBaseUrl,
    maxPublishPerCrawl,
    minScoreToPublish,
    maxRepoRadarAiPerCrawl,
    openrouterModel,
    openrouterFallbackModel,
    openrouterSecondFallbackModel,
    aiTranslationEnabled,
    aiImportanceReasonEnabled,
    allowPublishWithoutAi,
  ] = await Promise.all([
    getSetting('publish_threshold'),
    getSetting('pending_threshold'),
    getSetting('cron_schedule'),
    getSetting('admin_username'),
    getSetting('telegram_bot_token'),
    getSetting('telegram_chat_id'),
    getSetting('app_base_url'),
    getSetting('max_publish_per_crawl'),
    getSetting('min_score_to_publish'),
    getSetting('max_repo_radar_ai_per_crawl'),
    getSetting('openrouter_model'),
    getSetting('openrouter_fallback_model'),
    getSetting('openrouter_second_fallback_model'),
    getSetting('ai_translation_enabled'),
    getSetting('ai_importance_reason_enabled'),
    getSetting('allow_publish_without_ai'),
  ]);

  return {
    publish_threshold: parseInt(publishThreshold || '75', 10),
    pending_threshold: parseInt(pendingThreshold || '60', 10),
    cron_schedule: cronSchedule || '0 6 * * *',
    admin_username: adminUsername || 'admin',
    telegram_bot_token: telegramBotToken || envString('TELEGRAM_BOT_TOKEN'),
    telegram_chat_id: telegramChatId || envString('TELEGRAM_CHAT_ID'),
    app_base_url: appBaseUrl || process.env.APP_BASE_URL || 'http://localhost:3000',
    max_publish_per_crawl: parseIntSetting(maxPublishPerCrawl, 'MAX_PUBLISH_PER_CRAWL', 10),
    min_score_to_publish: parseIntSetting(minScoreToPublish, 'MIN_SCORE_TO_PUBLISH', 75),
    max_repo_radar_ai_per_crawl: parseIntSetting(maxRepoRadarAiPerCrawl, 'MAX_REPO_RADAR_AI_PER_CRAWL', 10),
    openrouter_model: openrouterModel || envString('OPENROUTER_MODEL', 'openrouter/auto'),
    openrouter_fallback_model: openrouterFallbackModel || envString('OPENROUTER_FALLBACK_MODEL', 'google/gemini-2.5-flash'),
    openrouter_second_fallback_model: openrouterSecondFallbackModel || envString('OPENROUTER_SECOND_FALLBACK_MODEL', 'mistralai/mistral-small-3.2-24b-instruct'),
    ai_translation_enabled: parseBoolSetting(aiTranslationEnabled, 'AI_TRANSLATION_ENABLED', true),
    ai_importance_reason_enabled: parseBoolSetting(aiImportanceReasonEnabled, 'AI_IMPORTANCE_REASON_ENABLED', true),
    allow_publish_without_ai: parseBoolSetting(allowPublishWithoutAi, 'ALLOW_PUBLISH_WITHOUT_AI', false),
  };
}
