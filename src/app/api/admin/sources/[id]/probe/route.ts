import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/authGuard';
import { prisma } from '@/lib/prisma';
import { toSourceConfig } from '@/lib/sources/catalog';
import { probeSource } from '@/lib/sources/reader';
import { recordSourceResult } from '@/lib/sources/health';

const probing = new Set<string>();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;
  const { id } = await params;
  if (probing.has(id)) return NextResponse.json({ error: 'Probe already running' }, { status: 409 });
  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  probing.add(id);
  try {
    const result = await probeSource(toSourceConfig(source));
    const recorded = await recordSourceResult(id, result, undefined, true, source);
    if (!recorded) return NextResponse.json({ error: 'Source configuration changed while probing' }, { status: 409 });
    const { items, ...report } = result;
    return NextResponse.json({ data: { ...report, itemCount: items.length } });
  } catch { return NextResponse.json({ error: 'Invalid source configuration or unavailable database' }, { status: 400 }); }
  finally { probing.delete(id); }
}