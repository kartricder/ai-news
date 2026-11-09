import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayloadFromRequest, requireAdminApi } from '@/lib/authGuard';
import { generateSlug, normalizeCanonicalUrl } from '@/lib/utils';
import { fingerprintContent } from '@/lib/news/identity';
import { createIdentityArticle, findIdentityOwner } from '@/lib/news/storeIdentity';

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
    const body = await request.json().catch(() => null);
    if (!body || body.reviewOverride !== true || typeof body.reviewReason !== 'string' || body.reviewReason.trim().length < 12 || body.reviewReason.length > 1000) return NextResponse.json({ error: 'Explicit reviewOverride and reviewReason (12-1000 characters) required for repository discovery' }, { status: 400 });
    if (!item.aiSummaryVi.trim() || !['success', 'fallback_success', 'review'].includes(item.aiStatus)) return NextResponse.json({ error: 'Review and prepare Vietnamese repository content before publishing' }, { status: 409 });
    if (item.leaseUntil && item.leaseUntil > new Date()) return NextResponse.json({ error: 'Repository is currently processing' }, { status: 409 });

    const canonicalUrl = normalizeCanonicalUrl(item.url);
    if (!canonicalUrl) return NextResponse.json({ error: 'Invalid repository URL' }, { status: 400 });
    const identityKey = `url:${canonicalUrl}`;
    const fingerprint = fingerprintContent(item.fullName, item.description);
    const existing = await findIdentityOwner({ identityKey, fingerprint });
    if (existing) {
      if (existing.status === 'published') await prisma.repoRadarItem.update({ where: { id }, data: { status: 'published' } });
      return NextResponse.json({ data: existing, duplicate: true });
    }

    const title = `Repo Radar: ${item.fullName}`;
    const slug = await uniqueSlug(generateSlug(`repo-radar-${item.fullName}`));
    const saved = await createIdentityArticle({
        title,
        titleVi: title,
        slug,
        summaryVi: item.aiSummaryVi,
        briefVi: item.aiSummaryVi,
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
        originalPublishedAt: null,
        originalText: item.description,
        originalLanguage: 'en',
        evidenceLevel: 'snippet',
        sourceKind: 'engineering',
        publisherKey: `github:${item.owner.toLowerCase()}`,
        qualityFlags: JSON.stringify(['repository-discovery-not-release', 'missing-published-date']),
        processingStatus: 'review',
        processingReason: 'repository-discovery-awaiting-admin-approval',
        category: 'repo-radar',
        tags: ['repo-radar', 'github', item.language, ...item.topics.split(',').map((topic) => topic.trim())].filter(Boolean).join(', '),
        importanceScore: item.repoScore,
        reasonForScore: `Repo Radar score ${item.repoScore}`,
        status: 'pending',
        aiProvider: item.aiProvider,
        aiModel: item.aiModel,
        aiStatus: item.aiStatus,
        aiError: item.aiError,
        aiProcessedAt: item.updatedAt,
        canonicalUrl,
        publishedAt: null,
        identityKey,
        fingerprint,
        contentHash: fingerprint,
    });

    if (!saved.created) return NextResponse.json({ data: saved.article, duplicate: true });
    const published = await prisma.$transaction(async (transaction) => {
      const changed = await transaction.repoRadarItem.updateMany({ where: { id, updatedAt: item.updatedAt }, data: { status: 'published', leaseOwner: null, leaseUntil: null } });
      if (!changed.count) return null;
      const article = await transaction.article.update({ where: { id: saved.article.id }, data: { status: 'published', publishedAt: new Date(), processingStatus: 'ready', processingReason: 'admin-approved-repository-discovery' } });
      await transaction.adminAudit.create({ data: { actor: getAdminPayloadFromRequest(request)!.username, action: 'approve-repo-discovery', articleId: article.id,
        beforeJson: JSON.stringify({ repoId: id, repoStatus: item.status, status: 'pending', slug: article.slug }),
        afterJson: JSON.stringify({ status: article.status, slug: article.slug, reviewReason: body.reviewReason, qualityFlags: article.qualityFlags }) } });
      return article;
    });
    if (!published) return NextResponse.json({ error: 'Repository changed; draft saved for article review' }, { status: 409 });
    return NextResponse.json({ data: published, duplicate: false });
  } catch (error) {
    console.error('POST /api/admin/repo-radar/[id]/publish error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
