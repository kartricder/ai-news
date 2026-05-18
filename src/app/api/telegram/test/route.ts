import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const tokenSetting = await prisma.appSetting.findUnique({
      where: { key: 'telegram_bot_token' },
    });
    const chatIdSetting = await prisma.appSetting.findUnique({
      where: { key: 'telegram_chat_id' },
    });

    const token = tokenSetting?.value;
    const chatId = chatIdSetting?.value;

    if (!token || !chatId) {
      return NextResponse.json(
        { error: 'Telegram bot not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID first.' },
        { status: 400 }
      );
    }

    // Attempt to send a test message via Telegram Bot API
    const text = encodeURIComponent(
      '🧪 *AI News Việt Nam — Tin nhắn kiểm tra*\n\n' +
      'Bot Telegram đã được cấu hình thành công!\n' +
      'Bạn sẽ nhận được thông báo khi có bài viết AI mới.'
    );

    const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${text}&parse_mode=Markdown`;

    const response = await fetch(url);
    const result = await response.json();

    if (!result.ok) {
      // Log failed attempt
      await prisma.telegramLog.create({
        data: {
          articleId: 'test',
          chatIdMasked: chatId.slice(0, 3) + '***',
          status: 'failed',
          errorMessage: result.description || 'Unknown Telegram API error',
        },
      });

      return NextResponse.json(
        { error: `Telegram API error: ${result.description}` },
        { status: 502 }
      );
    }

    // Log success
    await prisma.telegramLog.create({
      data: {
        articleId: 'test',
        chatIdMasked: chatId.slice(0, 3) + '***',
        status: 'sent',
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      data: { success: true, message: 'Test message sent successfully!' },
    });
  } catch (error) {
    console.error('POST /api/telegram/test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
