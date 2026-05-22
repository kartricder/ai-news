import { prisma } from '@/lib/prisma';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function trimDescription(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 300 ? `${normalized.slice(0, 297)}...` : normalized;
}

export async function GET() {
  const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const articles = await prisma.article.findMany({
    where: { status: 'published' },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 20,
    select: {
      slug: true,
      title: true,
      titleVi: true,
      briefVi: true,
      summaryVi: true,
      sourceName: true,
      sourceUrl: true,
      originalUrl: true,
      category: true,
      importanceScore: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  const lastBuildDate = (articles[0]?.publishedAt ?? articles[0]?.createdAt ?? new Date()).toUTCString();
  const items = articles.map((article) => {
    const articleUrl = `${baseUrl}/articles/${article.slug}`;
    const sourceUrl = article.originalUrl || article.sourceUrl;
    const title = article.titleVi || article.title;
    const description = trimDescription(article.briefVi || article.summaryVi);
    const publishDate = (article.publishedAt ?? article.createdAt).toUTCString();

    return [
      '<item>',
      `  <title>${escapeXml(title)}</title>`,
      `  <link>${escapeXml(articleUrl)}</link>`,
      `  <description>${escapeXml(description)}</description>`,
      `  <pubDate>${escapeXml(publishDate)}</pubDate>`,
      `  <guid isPermaLink="true">${escapeXml(articleUrl)}</guid>`,
      `  <category>${escapeXml(article.category)}</category>`,
      `  <source url="${escapeXml(sourceUrl)}">${escapeXml(article.sourceName)}</source>`,
      `  <aiNews:importanceScore>${article.importanceScore}</aiNews:importanceScore>`,
      '</item>',
    ].join('\n');
  }).join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:aiNews="https://ainews.vn/rss">',
    '<channel>',
    '  <title>AI News Việt Nam</title>',
    `  <link>${escapeXml(baseUrl)}</link>`,
    '  <description>Tin tức AI tổng hợp, dịch và chấm điểm tự động</description>',
    '  <language>vi</language>',
    `  <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>`,
    items,
    '</channel>',
    '</rss>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
