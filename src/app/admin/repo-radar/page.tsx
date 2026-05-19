'use client';

import { useEffect, useState } from 'react';

type RepoRadarItem = {
  id: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
  topics: string;
  repoScore: number;
  aiSummaryVi: string;
  whyImportant: string;
  status: string;
  aiStatus: string;
};

export default function AdminRepoRadarPage() {
  const [items, setItems] = useState<RepoRadarItem[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    const res = await fetch('/api/admin/repo-radar');
    if (res.ok) {
      const data = await res.json();
      setItems(data.data || []);
    }
  }

  async function update(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/repo-radar/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setMessage(res.ok ? 'Da cap nhat repo' : 'Khong cap nhat duoc repo');
    await load();
  }

  async function publish(id: string) {
    const res = await fetch(`/api/admin/repo-radar/${id}/publish`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Da publish: ${data.data?.slug || 'repo'}` : data.error || 'Publish failed');
    await load();
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      const res = await fetch('/api/admin/repo-radar');
      if (res.ok && !cancelled) {
        const data = await res.json();
        setItems(data.data || []);
      }
    }
    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-slate-950">Repo Radar</h1>
        <button onClick={load} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">Refresh</button>
      </div>
      {message && <p className="mb-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}
      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <a href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 hover:text-sky-900">{item.fullName}</a>
                <p className="mt-1 text-sm text-slate-500">
                  score {item.repoScore} · {item.stars.toLocaleString()} stars · {item.forks.toLocaleString()} forks · {item.language || 'N/A'} · {item.status} · AI {item.aiStatus}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => publish(item.id)} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Publish</button>
                <button onClick={() => update(item.id, { status: 'ignored' })} className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white">Ignore</button>
                <button onClick={() => update(item.id, { status: 'tracked' })} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">Track</button>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.aiSummaryVi || item.description || 'Chua co mo ta.'}</p>
            {item.whyImportant && <p className="mt-2 text-sm leading-6 text-slate-700">{item.whyImportant}</p>}
            {item.topics && <p className="mt-2 text-xs text-slate-500">{item.topics}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
