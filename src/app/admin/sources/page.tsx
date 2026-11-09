'use client';

import { FormEvent, useEffect, useState } from 'react';

type Source = {
  id: string;
  name: string;
  type: string;
  url: string;
  enabled: boolean;
  configJson: string;
  verificationStatus: string;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string;
  consecutiveFailures: number;
  nextAttemptAt: string | null;
  publisherKey: string;
  kind: string;
  language: string | null;
  lastFetch: { status: string; httpStatus: number | null; errorCode: string | null; fetchedCount: number; durationMs: number } | null;
};

export default function AdminSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [message, setMessage] = useState('');
  const [probing, setProbing] = useState<string | null>(null);
  const [samples, setSamples] = useState<Record<string, { title: string; url: string; publishedAt: string | null }[]>>({});

  function localDate(value: string | null) {
    return value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '-';
  }

  async function probe(id: string) {
    setProbing(id);
    try {
      const response = await fetch(`/api/admin/sources/${id}/probe`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) setMessage(result.error || 'Không kiểm tra được nguồn');
      else {
        setSamples((current) => ({ ...current, [id]: result.data.samples || [] }));
        setMessage(`${result.data.verificationStatus} · HTTP ${result.data.httpStatus || '-'} · ${result.data.durationMs} ms${result.data.stale ? ' · stale' : ''}${result.data.errorCode ? ` · ${result.data.errorCode}` : ''}`);
      }
      await load();
    } catch { setMessage('Không kết nối được máy chủ'); }
    finally { setProbing(null); }
  }

  async function load() {
    const res = await fetch('/api/admin/sources');
    if (res.ok) {
      const data = await res.json();
      setSources(data.data);
    }
  }

  async function patchSource(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const result = await res.json(); setMessage(result.error || 'Không cập nhật được source'); }
    await load();
  }

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const res = await fetch('/api/admin/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        type: form.get('type'),
        url: form.get('url'),
      }),
    });
    setMessage(res.ok ? 'Đã thêm source' : 'Không thêm được source');
    if (res.ok) formElement.reset();
    await load();
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      const res = await fetch('/api/admin/sources');
      if (res.ok && !cancelled) {
        const data = await res.json();
        setSources(data.data);
      }
    }
    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold text-slate-950">Nguồn crawl</h1>

      <form onSubmit={addSource} className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_140px_1.5fr_auto]">
        <input name="name" placeholder="Tên source" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <select name="type" defaultValue="rss" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="rss">rss</option>
          <option value="reddit">reddit</option>
          <option value="github">github</option>
          <option value="hackernews">hackernews</option>
          <option value="arxiv">arxiv</option>
          <option value="github-release">github-release</option>
        </select>
        <input name="url" placeholder="URL" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Thêm</button>
      </form>

      {message && <p role="status" className="mt-4 break-words text-sm text-slate-600">{message}</p>}

      <div className="mt-5 overflow-x-auto border-y border-slate-200">
        <table className="w-full min-w-[960px] table-fixed text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="w-44 p-3">Tên / Type</th>
              <th className="p-3">URL / Config</th>
              <th className="w-64 p-3">Health</th>
              <th className="w-24 p-3">Bật</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-t border-slate-200">
                <td className="break-words p-3 font-medium">{source.name}<div className="mt-1 text-xs text-slate-500">{source.type} · {source.kind || '-'} · {source.language || 'unknown'}</div><div className="mt-1 text-xs text-slate-500">{source.publisherKey || '-'}</div></td>
                <td className="p-3">
                  <input
                    aria-label={`URL ${source.name}`}
                    defaultValue={source.url}
                    onBlur={(event) => {
                      if (event.target.value !== source.url) patchSource(source.id, { url: event.target.value });
                    }}
                    className="w-full rounded-md border border-slate-300 px-2 py-1"
                  />
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-slate-500">Config</summary>
                    <textarea aria-label={`Config ${source.name}`} defaultValue={source.configJson} rows={3}
                      className="mt-2 w-full rounded border border-slate-300 p-2 font-mono text-xs"
                      onBlur={(event) => { if (event.target.value !== source.configJson) void patchSource(source.id, { configJson: event.target.value }); }} />
                  </details>
                  {samples[source.id]?.map((sample) => <a key={sample.url} href={sample.url} target="_blank" rel="noopener noreferrer" className="mt-2 block break-words text-xs text-sky-700">{sample.title}</a>)}
                </td>
                <td className="break-words p-3 text-xs">
                  <strong className={source.lastError ? 'text-red-700' : source.verificationStatus === 'verified' ? 'text-emerald-700' : 'text-slate-600'}>{source.verificationStatus}</strong>
                  <div className="mt-1">Thành công: {localDate(source.lastSuccessAt)}</div>
                  <div className="mt-1">Lần thử: {localDate(source.lastAttemptAt)}</div>
                  {source.lastFetch && <div className={`mt-1 ${source.lastFetch.status === 'failed' ? 'text-red-700' : source.lastFetch.errorCode === 'stale-feed' ? 'text-amber-700' : 'text-slate-600'}`}>
                    {source.lastFetch.status === 'not_modified' ? 'Không đổi (304)' : source.lastFetch.status === 'failed' ? 'Fetch lỗi' : source.lastFetch.errorCode === 'stale-feed' ? 'Stale' : source.lastFetch.status} · HTTP {source.lastFetch.httpStatus || '-'} · {source.lastFetch.fetchedCount} bài · {source.lastFetch.durationMs} ms
                  </div>}
                  {source.lastError && <div className="mt-1 text-red-700">{source.lastError} ({source.consecutiveFailures})</div>}
                  {source.nextAttemptAt && <div className="mt-1">Thử lại: {localDate(source.nextAttemptAt)}</div>}
                  <button type="button" title={`Kiểm tra ${source.name}`} disabled={probing !== null} onClick={() => void probe(source.id)} className="mt-2 rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50">{probing === source.id ? 'Đang kiểm tra...' : 'Kiểm tra'}</button>
                </td>
                <td className="p-3">
                  <input aria-label={`Bật ${source.name}`} type="checkbox" checked={source.enabled} disabled={!source.enabled && source.verificationStatus !== 'verified'} onChange={(event) => patchSource(source.id, { enabled: event.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
