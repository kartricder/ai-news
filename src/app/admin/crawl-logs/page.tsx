'use client';

import { useEffect, useState } from 'react';

type CrawlRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  totalFetched: number;
  totalPublished: number;
  totalPending: number;
  totalRejected: number;
  errorMessage: string;
  aiSuccess: number;
  aiFailed: number;
  totalDuplicates: number;
  repoRadarFound: number;
};

export default function CrawlLogsPage() {
  const [runs, setRuns] = useState<CrawlRun[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch('/api/crawl/trigger');
    if (res.ok) {
      const data = await res.json();
      setRuns(data.data);
    }
  }

  async function trigger() {
    setLoading(true);
    setMessage('');
    const res = await fetch('/api/crawl/trigger', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error || 'Crawl failed');
      return;
    }
    setMessage(`Crawl xong: fetched ${data.data.totalFetched}, published ${data.data.totalPublished}`);
    await load();
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      const res = await fetch('/api/crawl/trigger');
      if (res.ok && !cancelled) {
        const data = await res.json();
        setRuns(data.data);
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
        <h1 className="text-3xl font-bold text-slate-950">Crawl logs</h1>
        <button onClick={trigger} disabled={loading} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? 'Đang crawl...' : 'Chạy crawl thủ công'}
        </button>
      </div>
      {message && <p className="mb-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}
      <div className="overflow-x-auto border-y border-slate-200">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3">Bắt đầu</th>
              <th className="p-3">Status</th>
              <th className="p-3">Fetched</th>
              <th className="p-3">Published</th>
              <th className="p-3">Pending</th>
              <th className="p-3">Rejected</th>
              <th className="p-3">AI ok / failed</th>
              <th className="p-3">Duplicate / Repo</th>
              <th className="p-3">Warnings</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-t border-slate-200">
                <td className="p-3">{new Date(run.startedAt).toLocaleString('vi-VN')}</td>
                <td className="p-3">{run.status}</td>
                <td className="p-3">{run.totalFetched}</td>
                <td className="p-3">{run.totalPublished}</td>
                <td className="p-3">{run.totalPending}</td>
                <td className="p-3">{run.totalRejected}</td>
                <td className="p-3">{run.aiSuccess} / {run.aiFailed}</td>
                <td className="p-3">{run.totalDuplicates} / {run.repoRadarFound}</td>
                <td className="max-w-72 p-3">{run.errorMessage ? <details><summary className="cursor-pointer text-amber-800">Warnings</summary><p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs">{run.errorMessage}</p></details> : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
