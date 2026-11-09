import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/authGuard';
import { PATCH } from '@/app/api/articles/[...id]/route';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  const forwarded = new NextRequest(request.url, { method: 'PATCH', headers, body: JSON.stringify({ ...body, action: 'reprocess' }) });
  return PATCH(forwarded, { params: params.then(({ id }) => ({ id: [id] })) });
}