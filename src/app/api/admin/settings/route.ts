import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const settings = await prisma.appSetting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }
    return NextResponse.json({ data: settingsMap });
  } catch (error) {
    console.error('GET /api/admin/settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Upsert each setting
    for (const [key, value] of Object.entries(body)) {
      if (typeof key === 'string' && typeof value === 'string') {
        await prisma.appSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }
    }

    // Return updated settings
    const settings = await prisma.appSetting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    return NextResponse.json({ data: settingsMap });
  } catch (error) {
    console.error('PUT /api/admin/settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
