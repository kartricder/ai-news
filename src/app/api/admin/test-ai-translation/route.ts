import { NextRequest, NextResponse } from 'next/server';
import { AiProcessingError, processArticleWithAI } from '@/lib/ai/openRouter';
import { getAdminPayloadFromRequest, requireAdminApi } from '@/lib/authGuard';
import { prisma } from '@/lib/prisma';
import { createHash } from 'node:crypto';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body) || body.confirmPaidRequest !== true) return NextResponse.json({ error: 'Explicit confirmPaidRequest is required; configured budget applies' }, { status: 400 });
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 1000 || typeof body.brief !== 'string' || body.brief.length < 160 || body.brief.length > 30_000 ||
      typeof body.sourceName !== 'string' || body.sourceName.length > 200 || typeof body.sourceUrl !== 'string' || body.sourceUrl.length > 2000) return NextResponse.json({ error: 'Provide bounded title, source and original evidence (160+ characters)' }, { status: 400 });
    try { const url = new URL(body.sourceUrl); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid-url'); }
    catch { return NextResponse.json({ error: 'Invalid source URL' }, { status: 400 }); }
    const audit = await prisma.adminAudit.create({ data: { actor: getAdminPayloadFromRequest(request)!.username, action: 'ai-preview',
      beforeJson: JSON.stringify({ title: body.title, inputHash: createHash('sha256').update(body.brief).digest('hex') }), afterJson: JSON.stringify({ status: 'requested' }) } });
    try {
    const result = await processArticleWithAI({
      originalTitle: body.title,
      originalText: body.brief,
      evidenceLevel: 'snippet',
      sourceName: body.sourceName,
      sourceUrl: body.sourceUrl,
      category: 'model-release',
      tags: ['AI', 'LLM', 'API'],
    });
    await prisma.adminAudit.update({ where: { id: audit.id }, data: { afterJson: JSON.stringify({ status: result.status, model: result.model, requiresReview: result.requiresReview }) } });
    return NextResponse.json({ data: result }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
      const code = error instanceof AiProcessingError ? error.code : 'internal';
      await prisma.adminAudit.update({ where: { id: audit.id }, data: { afterJson: JSON.stringify({ status: 'failed', code }) } });
      return NextResponse.json({ error: code }, { status: code === 'budget' ? 429 : code === 'configuration' ? 409 : 502 });
    }
  } catch {
    return NextResponse.json({ error: 'AI preview failed' }, { status: 500 });
  }
}
