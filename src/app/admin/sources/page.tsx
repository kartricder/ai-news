'use client';

import { FormEvent, useEffect, useState } from 'react';

type Source = {
  id: string;
  name: string;
  type: string;
  url: string;
  enabled: boolean;
};

export default function AdminSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [message, setMessage] = useState('');

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
    if (!res.ok) setMessage('Không cập nhật được source');
    await load();
  }

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
    if (res.ok) event.currentTarget.reset();
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
      <p className="mt-2 text-sm text-slate-500">Tên source phải khớp `article.sourceName` để bài được lưu.</p>

      <form onSubmit={addSource} className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_140px_1.5fr_auto]">
        <input name="name" placeholder="Tên source" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <select name="type" defaultValue="rss" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="rss">rss</option>
          <option value="reddit">reddit</option>
          <option value="github">github</option>
          <option value="hackernews">hackernews</option>
        </select>
        <input name="url" placeholder="URL" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Thêm</button>
      </form>

      {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3">Tên</th>
              <th className="p-3">Type</th>
              <th className="p-3">URL</th>
              <th className="p-3">Bật</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-t border-slate-200">
                <td className="p-3 font-medium">{source.name}</td>
                <td className="p-3">{source.type}</td>
                <td className="p-3">
                  <input
                    defaultValue={source.url}
                    onBlur={(event) => {
                      if (event.target.value !== source.url) patchSource(source.id, { url: event.target.value });
                    }}
                    className="w-full rounded-md border border-slate-300 px-2 py-1"
                  />
                </td>
                <td className="p-3">
                  <input type="checkbox" checked={source.enabled} onChange={(event) => patchSource(source.id, { enabled: event.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
