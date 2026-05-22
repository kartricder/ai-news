import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/authGuard';
import { prisma } from '@/lib/prisma';
import { getAppSettings, getSetting, setSetting } from '@/lib/settings';
import { sendTelegramMessage } from '@/lib/telegram';

const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LAST_DIGEST_KEY = 'telegram_last_digest_sent';

type DigestArticle = {
  slug: string;
  title: string;
  titleVi: string;
  importanceScore: number;
  sourceName: string;
  publishedAt: Date | null;
};

function digestSince() {
  return new Date(Date.now() - DIGEST_WINDOW_MS);
}

function serializedArticles(articles: DigestArticle[]) {
  return articles.map((article) => ({
    ...article,
    publishedAt: article.publishedAt?.toISOString() ?? null,
  }));
}

function isRecentDigest(value: string | null) {
  if (!value) return false;
  const sentAt = new Date(value).getTime();
  return Number.isFinite(sentAt) && Date.now() - sentAt < DIGEST_WINDOW_MS;
}

function escapeMarkdown(value: string) {
  return value.replace(/[\\_*[\]()`]/g, '\\$&');
}

async function getDigestArticles() {
  return prisma.article.findMany({
    where: { status: 'published', publishedAt: { gte: digestSince() } },
    orderBy: [{ importanceScore: 'desc' }, { publishedAt: 'desc' }],
    take: 5,
    select: {
      slug: true,
      title: true,
      titleVi: true,
      importanceScore: true,
      sourceName: true,
      publishedAt: true,
    },
  });
}

function formatDigestMessage(articles: DigestArticle[], baseUrl: string) {
  const end = new Date();
  const start = digestSince();
  const lines = [
    `*Bản tin AI tuần này* (${start.toLocaleDateString('vi-VN')} - ${end.toLocaleDateString('vi-VN')})`,
    '',
    'Top tin quan trọng nhất:',
    '',
  ];

  articles.forEach((article, index) => {
    lines.push(
      `${index + 1}. [Score: ${article.importanceScore}] ${escapeMarkdown(article.titleVi || article.title)}`,
      `${baseUrl}/articles/${article.slug}`,
      ''
    );
  });

  lines.push(`Xem tất cả: ${baseUrl}`);
  return lines.join('\n');
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const [articles, lastSentAt, settings] = await Promise.all([
      getDigestArticles(),
      getSetting(LAST_DIGEST_KEY),
      getAppSettings(),
    ]);

    return NextResponse.json({
      data: {
        articles: serializedArticles(articles),
        lastSentAt,
        configured: Boolean(settings.telegram_bot_token && settings.telegram_chat_id),
      },
    });
  } catch (error) {
    console.error('GET /api/admin/telegram/digest error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const [lastSentAt, settings, articles] = await Promise.all([
      getSetting(LAST_DIGEST_KEY),
      getAppSettings(),
      getDigestArticles(),
    ]);

    if (isRecentDigest(lastSentAt)) {
      return NextResponse.json({ error: 'Digest đã được gửi trong 7 ngày qua' }, { status: 429 });
    }

    if (!settings.telegram_bot_token || !settings.telegram_chat_id) {
      return NextResponse.json({ error: 'Telegram chưa cấu hình' }, { status: 400 });
    }

    if (articles.length === 0) {
      return NextResponse.json({ error: 'Không có bài published trong 7 ngày qua' }, { status: 400 });
    }

    const baseUrl = settings.app_base_url.replace(/\/$/, '');
    const ok = await sendTelegramMessage({
      chatId: settings.telegram_chat_id,
      text: formatDigestMessage(articles, baseUrl),
      parseMode: 'Markdown',
    });

    if (!ok) {
      return NextResponse.json({ error: 'Không gửi được bản tin Telegram' }, { status: 502 });
    }

    const sentAt = new Date().toISOString();
    await setSetting(LAST_DIGEST_KEY, sentAt);

    return NextResponse.json({ data: { success: true, sentAt } });
  } catch (error) {
    console.error('POST /api/admin/telegram/digest error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
