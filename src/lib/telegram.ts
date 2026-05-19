import { prisma } from './prisma';
import { getAppSettings, getSetting, setSetting } from './settings';

const TELEGRAM_API = 'https://api.telegram.org/bot';

export interface TelegramMessage {
  chatId: string;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
}

/**
 * Log a non-article Telegram event (e.g. system notifications, errors, summaries)
 * without requiring an articleId.
 */
export async function logTelegramEvent(
  chatId: string,
  status: 'pending' | 'sent' | 'failed',
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.telegramLog.create({
      data: {
        articleId: 'system', // placeholder for non-article messages
        chatIdMasked: maskChatId(chatId),
        status,
        errorMessage: errorMessage || '',
        sentAt: status === 'sent' ? new Date() : null,
      },
    });
  } catch (err) {
    console.error('[Telegram] Failed to log event:', err);
  }
}

/**
 * Mask a chat ID for privacy logging.
 */
function maskChatId(chatId: string): string {
  if (chatId.length <= 4) return '****';
  return chatId.slice(0, 2) + '****' + chatId.slice(-2);
}

/**
 * Send a text message to a Telegram chat via Bot API.
 */
export async function sendTelegramMessage(message: TelegramMessage): Promise<boolean> {
  const settings = await getAppSettings();
  const botToken = settings.telegram_bot_token;
  if (!botToken) {
    console.warn('[Telegram] Bot token not configured. Skipping message.');
    return false;
  }

  try {
    const body: Record<string, string> = {
      chat_id: message.chatId,
      text: message.text,
    };
    if (message.parseMode) body.parse_mode = message.parseMode;

    const response = await fetch(
      `${TELEGRAM_API}${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    const result = await response.json();

    // Log the send attempt using the new helper
    await logTelegramEvent(
      message.chatId,
      result.ok ? 'sent' : 'failed',
      result.ok ? undefined : result.description || 'Unknown error'
    );

    if (!result.ok) {
      console.error('[Telegram] API error:', result.description);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Telegram] Send failed:', err);

    await logTelegramEvent(
      message.chatId,
      'failed',
      err instanceof Error ? err.message : 'Unknown error'
    );

    return false;
  }
}

export async function sendPublishedArticleTelegram(article: {
  id: string;
  title: string;
  summaryVi: string;
  whyImportant?: string;
  importanceScore: number;
  sourceName: string;
  tags: string;
  slug: string;
}): Promise<boolean> {
  const settings = await getAppSettings();
  const botToken = settings.telegram_bot_token;
  const chatId = settings.telegram_chat_id;

  if (!botToken || !chatId) {
    await logArticleTelegram(article.id, chatId || '', 'failed', 'Telegram is not configured');
    return false;
  }

  const tags = article.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(', ');
  const baseUrl = settings.app_base_url.replace(/\/$/, '');
  const text = [
    '🔥 AI Important News',
    '',
    article.title,
    '',
    article.summaryVi,
    '',
    'Vì sao quan trọng:',
    article.whyImportant || 'Chưa có ghi chú.',
    '',
    `Điểm: ${article.importanceScore}/100`,
    `Nguồn: ${article.sourceName}`,
    `Tag: ${tags || 'N/A'}`,
    '',
    `Xem chi tiết: ${baseUrl}/articles/${article.slug}`,
  ].join('\n');

  try {
    const response = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const result = await response.json().catch(() => ({}));
    await logArticleTelegram(article.id, chatId, result.ok ? 'sent' : 'failed', result.ok ? undefined : result.description || 'Telegram API error');
    return Boolean(result.ok);
  } catch (error) {
    await logArticleTelegram(article.id, chatId, 'failed', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Log a Telegram send for a specific article.
 * Uses the correct Prisma schema: articleId, chatIdMasked, status, errorMessage, sentAt.
 */
export async function logArticleTelegram(
  articleId: string,
  chatId: string,
  status: 'pending' | 'sent' | 'failed',
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.telegramLog.create({
      data: {
        articleId,
        chatIdMasked: maskChatId(chatId),
        status,
        errorMessage: errorMessage || '',
        sentAt: status === 'sent' ? new Date() : null,
      },
    });
  } catch (err) {
    console.error('[Telegram] Failed to log article telegram:', err);
  }
}

/**
 * Send a notification about newly published articles.
 */
export async function notifyNewArticles(articles: { title: string; url: string; score: number; summary: string }[]): Promise<void> {
  const chatId = await getSetting('telegram_chat_id');
  if (!chatId) {
    console.warn('[Telegram] Chat ID not configured. Skipping notification.');
    return;
  }

  if (articles.length === 0) return;

  // Send summary message
  const summaryText = `🤖 *AI News Digest*\n\nCó *${articles.length}* tin mới vừa được tổng hợp:\n`;
  await sendTelegramMessage({ chatId, text: summaryText, parseMode: 'Markdown' });

  // Send individual article messages (max 10 to avoid spam)
  const maxArticles = Math.min(articles.length, 10);
  for (let i = 0; i < maxArticles; i++) {
    const article = articles[i];
    const text = [
      `*${article.title}*`,
      `📝 ${article.summary.substring(0, 150)}...`,
      `⭐ Điểm: ${article.score}/100`,
      `🔗 [Đọc thêm](${article.url})`,
    ].join('\n\n');

    await sendTelegramMessage({ chatId, text, parseMode: 'Markdown' });

    // Rate limit: 1 message per second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Update last notification time
  await setSetting('last_notification_at', new Date().toISOString());
}

/**
 * Send error notification to admin.
 */
export async function notifyError(sourceName: string, error: string): Promise<void> {
  const chatId = await getSetting('telegram_chat_id');
  if (!chatId) return;

  const text = `⚠️ *Crawl Error*\n\n*Nguồn:* ${sourceName}\n*Lỗi:* ${error.substring(0, 200)}`;
  await sendTelegramMessage({ chatId, text, parseMode: 'Markdown' });
}

/**
 * Post a daily summary to Telegram.
 */
export async function postDailySummary(stats: {
  totalArticles: number;
  published: number;
  pending: number;
  rejected: number;
  sources: string[];
}): Promise<void> {
  const chatId = await getSetting('telegram_chat_id');
  if (!chatId) return;

  const text = [
    `📊 *Daily AI News Summary*`,
    ``,
    `📅 ${new Date().toLocaleDateString('vi-VN')}`,
    ``,
    `• Tổng số bài: ${stats.totalArticles}`,
    `• ✅ Đã đăng: ${stats.published}`,
    `• ⏳ Chờ duyệt: ${stats.pending}`,
    `• ❌ Từ chối: ${stats.rejected}`,
    ``,
    `📡 Nguồn: ${stats.sources.join(', ')}`,
  ].join('\n');

  await sendTelegramMessage({ chatId, text, parseMode: 'Markdown' });
}
