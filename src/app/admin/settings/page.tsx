'use client';

import { FormEvent, useEffect, useState } from 'react';

type Settings = {
  publish_threshold?: string;
  pending_threshold?: string;
  cron_schedule?: string;
  app_base_url?: string;
  max_publish_per_crawl?: string;
  min_score_to_publish?: string;
  max_repo_radar_ai_per_crawl?: string;
  openrouter_model?: string;
  openrouter_fallback_model?: string;
  openrouter_second_fallback_model?: string;
  ai_translation_enabled?: string;
  ai_importance_reason_enabled?: string;
  allow_publish_without_ai?: string;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => res.json())
      .then((data) => setSettings(data.data || {}));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publish_threshold: form.get('publish_threshold'),
        pending_threshold: form.get('pending_threshold'),
        cron_schedule: form.get('cron_schedule'),
        app_base_url: form.get('app_base_url'),
        max_publish_per_crawl: form.get('max_publish_per_crawl'),
        min_score_to_publish: form.get('min_score_to_publish'),
        max_repo_radar_ai_per_crawl: form.get('max_repo_radar_ai_per_crawl'),
        openrouter_model: form.get('openrouter_model'),
        openrouter_fallback_model: form.get('openrouter_fallback_model'),
        openrouter_second_fallback_model: form.get('openrouter_second_fallback_model'),
        ai_translation_enabled: form.get('ai_translation_enabled'),
        ai_importance_reason_enabled: form.get('ai_importance_reason_enabled'),
        allow_publish_without_ai: form.get('allow_publish_without_ai'),
      }),
    });
    setMessage(res.ok ? 'Đã lưu cài đặt' : 'Không lưu được cài đặt');
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-3xl font-bold text-slate-950">Cài đặt hệ thống</h1>
      <form onSubmit={save} className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Publish threshold
          <input name="publish_threshold" defaultValue={settings.publish_threshold || '75'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Pending threshold
          <input name="pending_threshold" defaultValue={settings.pending_threshold || '60'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Cron schedule
          <input name="cron_schedule" defaultValue={settings.cron_schedule || '0 6 * * *'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          APP_BASE_URL
          <input name="app_base_url" defaultValue={settings.app_base_url || 'http://localhost:3000'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Max publish per crawl
            <input name="max_publish_per_crawl" defaultValue={settings.max_publish_per_crawl || '10'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Min score to publish
            <input name="min_score_to_publish" defaultValue={settings.min_score_to_publish || '75'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Repo Radar AI max
            <input name="max_repo_radar_ai_per_crawl" defaultValue={settings.max_repo_radar_ai_per_crawl || '10'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          OpenRouter model
          <input name="openrouter_model" defaultValue={settings.openrouter_model || 'openrouter/auto'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Fallback model 1
          <input name="openrouter_fallback_model" defaultValue={settings.openrouter_fallback_model || 'google/gemini-2.5-flash'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Fallback model 2
          <input name="openrouter_second_fallback_model" defaultValue={settings.openrouter_second_fallback_model || 'mistralai/mistral-small-3.2-24b-instruct'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            ['ai_translation_enabled', 'AI translation'],
            ['ai_importance_reason_enabled', 'AI importance'],
            ['allow_publish_without_ai', 'Allow publish without AI'],
          ].map(([name, label]) => (
            <label key={name} className="block text-sm font-medium text-slate-700">
              {label}
              <select name={name} defaultValue={(settings as Record<string, string | undefined>)[name] || (name === 'allow_publish_without_ai' ? 'false' : 'true')} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
          ))}
        </div>
        <p className="mt-4 rounded-md bg-sky-50 p-3 text-sm leading-6 text-sky-800">
          VPS khuyến nghị dùng system cron chạy `npm run crawl` một lần mỗi ngày. App scheduler chỉ nên bật khi bạn muốn cron chạy trong process Node.
        </p>
        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
        <button className="mt-5 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Lưu</button>
      </form>
    </div>
  );
}
