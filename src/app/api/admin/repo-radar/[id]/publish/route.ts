import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/authGuard';
import { generateContentHash, generateSlug, normalizeCanonicalUrl } from '@/lib/utils';

async function uniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.article.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
  return slug;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const item = await prisma.repoRadarItem.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: 'Repo not found' }, { status: 404 });

    const canonicalUrl = normalizeCanonicalUrl(item.url);
    const existing = await prisma.article.findFirst({
      where: { OR: [{ canonicalUrl }, { originalUrl: canonicalUrl }, { sourceUrl: canonicalUrl }] },
    });
    if (existing) {
      await prisma.repoRadarItem.update({ where: { id }, data: { status: 'published' } });
      return NextResponse.json({ data: existing, duplicate: true });
    }

    const title = item.aiSummaryVi ? `Repo Radar: ${item.fullName}` : `${item.fullName}: ${item.description || 'AI repository'}`;
    const slug = await uniqueSlug(generateSlug(`repo-radar-${item.fullName}`));
    const article = await prisma.article.create({
      data: {
        title,
        titleVi: title,
        slug,
        summaryVi: item.aiSummaryVi || item.description || 'Repo AI dang duoc cong dong chu y.',
        briefVi: item.aiSummaryVi || '',
        whyImportant: item.whyImportant,
        contentVi: [
          item.aiSummaryVi || item.description,
          '',
          item.whyImportant,
          '',
          `GitHub: ${item.url}`,
          `Stars: ${item.stars}`,
          `Forks: ${item.forks}`,
          `Language: ${item.language || 'N/A'}`,
        ].filter(Boolean).join('\n'),
        sourceName: 'Repo Radar',
        sourceUrl: item.url,
        originalUrl: item.url,
        originalTitle: item.fullName,
        originalPublishedAt: item.lastPushedAt || new Date(),
        category: 'repo-radar',
        tags: ['repo-radar', 'github', item.language, ...item.topics.split(',').map((topic) => topic.trim())].filter(Boolean).join(', '),
        importanceScore: item.repoScore,
        reasonForScore: `Repo Radar score ${item.repoScore}`,
        status: 'published',
        aiProvider: item.aiProvider,
        aiModel: item.aiModel,
        aiStatus: item.aiStatus,
        aiError: item.aiError,
        aiProcessedAt: item.updatedAt,
        canonicalUrl,
        publishedAt: new Date(),
        contentHash: generateContentHash(canonicalUrl, item.fullName),
      },
    });

    await prisma.repoRadarItem.update({ where: { id }, data: { status: 'published' } });
    return NextResponse.json({ data: article });
  } catch (error) {
    console.error('POST /api/admin/repo-radar/[id]/publish error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
