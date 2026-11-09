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
  [key: string]: string | undefined;
};

const processingFields = ['ai_daily_budget_usd', 'ai_max_input_tokens', 'ai_max_output_tokens', 'ai_pricing_json', 'pending_cron_schedule', 'pending_process_limit'] as const;
const processingToggles = [
  ['ai_processing_enabled', 'AI processing'], ['ai_auto_publish_enabled', 'Auto publish'], ['pending_processing_enabled', 'Pending cron'],
] as const;

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => res.json())
      .then((data) => { if (!data.data) throw new Error('load-failed'); setSettings(data.data); setLoaded(true); })
      .catch(() => setMessage('Không tải được cài đặt'));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
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
        ai_translation_enabled: String(form.has('ai_translation_enabled')),
        ai_importance_reason_enabled: String(form.has('ai_importance_reason_enabled')),
        allow_publish_without_ai: String(form.has('allow_publish_without_ai')),
        ...Object.fromEntries(processingFields.map((key) => [key, form.get(key)])),
        ...Object.fromEntries(processingToggles.map(([key]) => [key, String(form.has(key))])),
      }),
    });
    const result = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Đã lưu cài đặt' : result.error || 'Không lưu được cài đặt');
    } catch { setMessage('Không kết nối được máy chủ'); }
    finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-3xl font-bold text-slate-950">Cài đặt hệ thống</h1>
      {!loaded && <p className="mt-4 text-sm text-slate-600">{message || 'Đang tải cài đặt...'}</p>}
      {loaded && <form onSubmit={save} className="mt-6 border-y border-slate-200 py-5">
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
            <input type="number" min="0" max="10" name="max_publish_per_crawl" defaultValue={settings.max_publish_per_crawl || '10'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Min score to publish
            <input name="min_score_to_publish" defaultValue={settings.min_score_to_publish || '75'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Repo Radar AI max
            <input type="number" min="0" max="10" name="max_repo_radar_ai_per_crawl" defaultValue={settings.max_repo_radar_ai_per_crawl || '10'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
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
            <label key={name} className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name={name} defaultChecked={settings[name] ? settings[name] === 'true' : name !== 'allow_publish_without_ai'} />
              {label}
            </label>
          ))}
        </div>
        <fieldset className="mt-6 border-t border-slate-200 pt-4">
          <legend className="text-base font-semibold">AI Budget / Pending</legend>
          <div className="mt-3 flex flex-wrap gap-5">{processingToggles.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input name={key} type="checkbox" defaultChecked={settings[key] === 'true'} />{label}</label>)}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ['ai_daily_budget_usd', 'Daily budget (USD)', 10000, '0.000001'],
              ['ai_max_input_tokens', 'Max input tokens', 100000, '1'],
              ['ai_max_output_tokens', 'Max output tokens', 16000, '1'],
            ].map(([key, label, maximum, step]) => <label key={key} className="min-w-0 text-sm font-medium">{label}<input required type="number" min="0" max={maximum} step={step} name={String(key)} defaultValue={settings[key] || '0'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>)}
          </div>
          <label className="mt-4 block text-sm font-medium">Verified model prices (USD / 1M tokens)<textarea name="ai_pricing_json" rows={8} spellCheck={false} defaultValue={settings.ai_pricing_json || '{}'} className="mt-1 w-full rounded-md border border-slate-300 p-3 font-mono text-xs" /></label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Pending cron (UTC)<input required name="pending_cron_schedule" defaultValue={settings.pending_cron_schedule || '*/15 * * * *'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-medium">Pending limit<input required type="number" min="0" max="10" name="pending_process_limit" defaultValue={settings.pending_process_limit || '10'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
          </div>
        </fieldset>
        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
        <button disabled={saving} className="mt-5 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button>
      </form>}
    </div>
  );
}
