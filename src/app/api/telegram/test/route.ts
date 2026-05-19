import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';
import { sendTelegramMessage } from '@/lib/telegram';
import { requireAdminApi } from '@/lib/authGuard';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const chatId = await getSetting('telegram_chat_id');
    const token = await getSetting('telegram_bot_token');

    if (!token || !chatId) {
      return NextResponse.json({ error: 'Telegram is not configured' }, { status: 400 });
    }

    const ok = await sendTelegramMessage({
      chatId,
      text: 'AI News Viet Nam - tin nhan kiem tra Telegram.',
    });

    if (!ok) {
      return NextResponse.json({ error: 'Telegram test failed' }, { status: 502 });
    }

    return NextResponse.json({ data: { success: true, message: 'Test message sent successfully' } });
  } catch (error) {
    console.error('POST /api/telegram/test error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
