import { NextRequest, NextResponse } from 'next/server';
import { getAppSettings, setSetting } from '@/lib/settings';
import { requireAdminApi } from '@/lib/authGuard';

function maskSecret(value: string | null) {
  if (!value) return '';
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}********${value.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const settings = await getAppSettings();

    return NextResponse.json({
      data: {
        telegram_bot_token: maskSecret(settings.telegram_bot_token),
        telegram_chat_id: settings.telegram_chat_id || '',
        configured: Boolean(settings.telegram_bot_token && settings.telegram_chat_id),
      },
    });
  } catch (error) {
    console.error('GET /api/telegram/config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if ('telegram_bot_token' in body) {
      if (typeof body.telegram_bot_token !== 'string') {
        return NextResponse.json({ error: 'Invalid telegram_bot_token' }, { status: 400 });
      }
      const token = body.telegram_bot_token.trim();
      if (token && !token.includes('*')) {
        await setSetting('telegram_bot_token', token, true);
      }
      if (!token) {
        await setSetting('telegram_bot_token', '', true);
      }
    }

    if ('telegram_chat_id' in body) {
      if (typeof body.telegram_chat_id !== 'string') {
        return NextResponse.json({ error: 'Invalid telegram_chat_id' }, { status: 400 });
      }
      await setSetting('telegram_chat_id', body.telegram_chat_id.trim(), true);
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('PUT /api/telegram/config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
