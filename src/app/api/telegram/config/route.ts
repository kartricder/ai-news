import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const token = await prisma.appSetting.findUnique({ where: { key: 'telegram_bot_token' } });
    const chatId = await prisma.appSetting.findUnique({ where: { key: 'telegram_chat_id' } });

    return NextResponse.json({
      data: {
        telegram_bot_token: token ? '***' : '',
        telegram_chat_id: chatId ? chatId.value : '',
        configured: !!(token && chatId && token.value && chatId.value),
      },
    });
  } catch (error) {
    console.error('GET /api/telegram/config error:', error);
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

    // Update Telegram config in AppSettings
    if ('telegram_bot_token' in body) {
      await prisma.appSetting.upsert({
        where: { key: 'telegram_bot_token' },
        update: { value: String(body.telegram_bot_token) },
        create: { key: 'telegram_bot_token', value: String(body.telegram_bot_token) },
      });
    }

    if ('telegram_chat_id' in body) {
      await prisma.appSetting.upsert({
        where: { key: 'telegram_chat_id' },
        update: { value: String(body.telegram_chat_id) },
        create: { key: 'telegram_chat_id', value: String(body.telegram_chat_id) },
      });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('PUT /api/telegram/config error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
