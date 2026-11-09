import { randomUUID } from 'node:crypto';
import { Prisma, type Article } from '@prisma/client';
import { prisma } from '../prisma';
import { getIdentityKey } from './identity';

type IdentityObservation = {
  identityKey: string | null;
  fingerprint: string;
};

export function legacyIdentity(article: {
  sourceId: string | null;
  externalId: string | null;
  originalUrl: string;
}): string | null {
  return getIdentityKey({
    sourceId: article.sourceId || '',
    externalId: article.externalId || undefined,
    articleUrl: article.originalUrl,
    sourceUrl: '',
    title: '',
    text: '',
    publishedAt: null,
    fetchedAt: '',
    language: null,
    evidenceLevel: 'title_only',
  });
}

export async function recordIdentityObservation(article: Article, fingerprint: string): Promise<Article> {
  if (!fingerprint || article.fingerprint === fingerprint || article.pendingFingerprint === fingerprint) return article;
  return prisma.article.update({
    where: { id: article.id },
    data: {
      pendingFingerprint: fingerprint,
      contentChangedAt: new Date(),
      identityReviewReason: article.fingerprint ? 'source-content-changed' : 'legacy-fingerprint-unavailable',
      ...(article.status === 'pending' ? { processingStatus: 'review', leaseOwner: null, leaseUntil: null } : {}),
    },
  });
}

export async function findIdentityOwner(observation: IdentityObservation): Promise<Article | null> {
  if (!observation.identityKey) return null;
  const owner = await prisma.article.findUnique({ where: { identityKey: observation.identityKey } });
  if (owner) return recordIdentityObservation(owner, observation.fingerprint);

  const legacy = await prisma.article.findMany({
    where: { identityKey: null, duplicateOfId: null },
    select: { id: true, sourceId: true, externalId: true, originalUrl: true, status: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const matching = legacy.filter((article) => legacyIdentity(article) === observation.identityKey);
  const existing = matching.find((article) => article.status === 'published') || matching[0];
  if (!existing) return null;

  try {
    await prisma.article.updateMany({
      where: { id: existing.id, identityKey: null },
      data: { identityKey: observation.identityKey },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
  }
  const claimed = await prisma.article.findUniqueOrThrow({ where: { identityKey: observation.identityKey } });
  for (const duplicate of matching) {
    if (duplicate.id === claimed.id) continue;
    await prisma.article.updateMany({
      where: { id: duplicate.id, identityKey: null, duplicateOfId: null },
      data: { duplicateOfId: claimed.id, duplicateReason: 'same-article-identity' },
    });
  }
  return recordIdentityObservation(claimed, observation.fingerprint);
}

export async function createIdentityArticle(data: Prisma.ArticleUncheckedCreateInput): Promise<{ article: Article; created: boolean }> {
  const observation = { identityKey: data.identityKey || null, fingerprint: data.fingerprint || '' };
  const existing = await findIdentityOwner(observation);
  if (existing) return { article: existing, created: false };

  const guardedData = !data.canonicalUrl || !data.identityKey
    ? { ...data, status: 'pending', publishedAt: null, identityReviewReason: data.identityReviewReason || 'missing-article-identity' }
    : data;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const article = await prisma.article.create({
        data: { ...guardedData, slug: attempt === 0 ? data.slug : `${data.slug.slice(0, 100)}-${randomUUID()}` },
      });
      return { article, created: true };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const owner = await findIdentityOwner(observation);
      if (owner) return { article: owner, created: false };
      if (!await prisma.article.findUnique({ where: { slug: data.slug } })) throw error;
      if (attempt === 2) throw error;
    }
  }
  throw new Error('Article identity could not be saved.');
}