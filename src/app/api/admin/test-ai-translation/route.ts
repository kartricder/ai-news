import { NextRequest, NextResponse } from 'next/server';
import { processArticleWithAI } from '@/lib/ai/openRouter';
import { requireAdminApi } from '@/lib/authGuard';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const result = await processArticleWithAI({
      originalTitle: typeof body.title === 'string' ? body.title : 'OpenAI releases a new model for coding and agent workflows',
      originalBrief: typeof body.brief === 'string' ? body.brief : 'The release focuses on better coding, reasoning, and API-based developer workflows.',
      sourceName: typeof body.sourceName === 'string' ? body.sourceName : 'AI Test',
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : 'https://example.com',
      category: 'model-release',
      tags: ['AI', 'LLM', 'API'],
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('POST /api/admin/test-ai-translation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'AI test failed' }, { status: 500 });
  }
}
