'use client';

import { FormEvent, useEffect, useState } from 'react';

type TelegramConfig = {
  telegram_bot_token: string;
  telegram_chat_id: string;
  configured: boolean;
};

type DigestArticle = {
  slug: string;
  title: string;
  titleVi: string;
  importanceScore: number;
  sourceName: string;
  publishedAt: string | null;
};

type DigestPreview = {
  articles: DigestArticle[];
  configured: boolean;
  lastSentAt: string | null;
};

const EMPTY_CONFIG: TelegramConfig = {
  telegram_bot_token: '',
  telegram_chat_id: '',
  configured: false,
};

const EMPTY_DIGEST: DigestPreview = {
  articles: [],
  configured: false,
  lastSentAt: null,
};

function sentWithinWeek(lastSentAt: string | null) {
  if (!lastSentAt) return false;
  const sentAt = new Date(lastSentAt).getTime();
  return Number.isFinite(sentAt) && Date.now() - sentAt < 7 * 24 * 60 * 60 * 1000;
}

export default function AdminTelegramPage() {
  const [config, setConfig] = useState<TelegramConfig>(EMPTY_CONFIG);
  const [message, setMessage] = useState('');
  const [digest, setDigest] = useState<DigestPreview>(EMPTY_DIGEST);
  const [digestLoading, setDigestLoading] = useState(true);
  const [digestSending, setDigestSending] = useState(false);
  const [digestMessage, setDigestMessage] = useState('');

  async function loadConfig() {
    const res = await fetch('/api/telegram/config');
    if (!res.ok) return;
    const data = await res.json();
    setConfig(data.data);
  }

  async function loadDigest() {
    setDigestLoading(true);
    const res = await fetch('/api/admin/telegram/digest');
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setDigest(data.data);
      setDigestMessage('');
    } else {
      setDigestMessage(data.error || 'Không tải được preview bản tin tuần');
    }
    setDigestLoading(false);
  }

  async function load() {
    await Promise.all([loadConfig(), loadDigest()]);
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

  async function sendDigest() {
    if (!window.confirm('Gửi bản tin tuần qua Telegram ngay bây giờ?')) return;

    setDigestSending(true);
    setDigestMessage('');
    const res = await fetch('/api/admin/telegram/digest', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setDigestMessage(res.ok ? 'Đã gửi bản tin tuần' : data.error || 'Không gửi được bản tin tuần');
    setDigestSending(false);
    if (res.ok) {
      await loadDigest();
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      const [configRes, digestRes] = await Promise.all([
        fetch('/api/telegram/config'),
        fetch('/api/admin/telegram/digest'),
      ]);

      if (configRes.ok && !cancelled) {
        const data = await configRes.json();
        setConfig(data.data);
      }

      const digestData = await digestRes.json().catch(() => ({}));
      if (!cancelled) {
        if (digestRes.ok) {
          setDigest(digestData.data);
        } else {
          setDigestMessage(digestData.error || 'Không tải được preview bản tin tuần');
        }
        setDigestLoading(false);
      }
    }

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  const lastDigestAt = digest.lastSentAt ? new Date(digest.lastSentAt) : null;
  const digestSentRecently = sentWithinWeek(digest.lastSentAt);
  const digestDisabled = digestLoading || digestSending || !digest.configured || digest.articles.length === 0 || digestSentRecently;

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

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Bản tin tuần</h2>
            <p className="mt-1 text-sm text-slate-500">Preview top 5 bài published có điểm cao trong 7 ngày qua.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            digestSentRecently ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {digestSentRecently && lastDigestAt
              ? `Đã gửi ${lastDigestAt.toLocaleString('vi-VN')}`
              : 'Chưa gửi tuần này'}
          </span>
        </div>

        {digestMessage && <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{digestMessage}</p>}

        {digestLoading ? (
          <p className="mt-4 text-sm text-slate-500">Đang tải preview...</p>
        ) : digest.articles.length > 0 ? (
          <ol className="mt-4 space-y-3">
            {digest.articles.map((article) => (
              <li key={article.slug} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                    {article.importanceScore}
                  </span>
                  <span className="font-medium text-slate-900">{article.titleVi || article.title}</span>
                  <span className="text-xs text-slate-400">{article.sourceName}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Không có bài published trong 7 ngày qua.</p>
        )}

        <div className="mt-5">
          <button
            type="button"
            onClick={sendDigest}
            disabled={digestDisabled}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {digestSending ? 'Đang gửi...' : 'Gửi bản tin tuần'}
          </button>
          {!digest.configured && !digestLoading && (
            <p className="mt-2 text-xs text-slate-500">Cần cấu hình Telegram trước khi gửi.</p>
          )}
        </div>
      </section>
    </div>
  );
}
