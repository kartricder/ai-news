import { prisma } from './prisma';
import { getSetting, setSetting } from './settings';

const TELEGRAM_API = 'https://api.telegram.org/bot';

export interface TelegramMessage {
  chatId: string;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
}

/**
 * Send a text message to a Telegram chat via Bot API.
 */
export async function sendTelegramMessage(message: TelegramMessage): Promise<boolean> {
  const botToken = await getSetting('telegram_bot_token');
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

    // Log the send attempt
    await prisma.telegramLog.create({
      data: {
        chatId: message.chatId,
        message: message.text.substring(0, 500),
        success: result.ok,
        error: result.ok ? null : result.description || 'Unknown error',
      },
    });

    if (!result.ok) {
      console.error('[Telegram] API error:', result.description);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Telegram] Send failed:', err);

    await prisma.telegramLog.create({
      data: {
        chatId: message.chatId,
        message: message.text.substring(0, 500),
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
    });

    return false;
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
