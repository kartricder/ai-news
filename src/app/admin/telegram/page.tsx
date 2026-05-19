'use client';

import { FormEvent, useEffect, useState } from 'react';

export default function AdminTelegramPage() {
  const [config, setConfig] = useState({ telegram_bot_token: '', telegram_chat_id: '', configured: false });
  const [message, setMessage] = useState('');

  async function load() {
    const res = await fetch('/api/telegram/config');
    if (res.ok) {
      const data = await res.json();
      setConfig(data.data);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch('/api/telegram/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_bot_token: form.get('telegram_bot_token'),
        telegram_chat_id: form.get('telegram_chat_id'),
      }),
    });
    setMessage(res.ok ? 'Đã lưu Telegram config' : 'Không lưu được Telegram config');
    await load();
  }

  async function test() {
    const res = await fetch('/api/telegram/test', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Đã gửi tin nhắn test' : data.error || 'Không gửi được tin nhắn test');
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      const res = await fetch('/api/telegram/config');
      if (res.ok && !cancelled) {
        const data = await res.json();
        setConfig(data.data);
      }
    }
    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-3xl font-bold text-slate-950">Telegram</h1>
      <p className="mt-2 text-sm text-slate-500">
        Token được lưu encrypted và API chỉ trả dạng masked.
      </p>
      <form onSubmit={save} className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          TELEGRAM_BOT_TOKEN
          <input name="telegram_bot_token" defaultValue={config.telegram_bot_token} placeholder="123456:ABC..." className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          TELEGRAM_CHAT_ID
          <input name="telegram_chat_id" defaultValue={config.telegram_chat_id} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <p className="mt-4 text-sm text-slate-600">Trạng thái: {config.configured ? 'Đã cấu hình' : 'Chưa cấu hình'}</p>
        {message && <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}
        <div className="mt-5 flex gap-2">
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Lưu</button>
          <button type="button" onClick={test} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">
            Gửi thử Telegram
          </button>
        </div>
      </form>
    </div>
  );
}
