'use client';

import { FormEvent, useEffect, useState } from 'react';
import { newsCategories } from '@/lib/news/categories';

type Article = {
  id: string;
  slug: string;
  title: string;
  summaryVi: string;
  contentVi: string;
  sourceName: string;
  category: string;
  tags: string;
  importanceScore: number;
  reasonForScore: string;
  status: string;
  createdAt: string;
  evidenceLevel: string;
  processingReason: string;
  qualityFlags: string;
  scoreVersion: string;
  eventKey: string | null;
  processingStatus: string;
  processingAttempts: number;
  nextRetryAt: string | null;
};

type ArticleDetail = Article & {
  originalTitle: string; originalText: string; originalUrl: string; originalPublishedAt: string | null;
  titleVi: string; briefVi: string; whyImportant: string; scoreBreakdown: string; aiClaims: string; aiUncertainties: string;
  promptVersion: string; schemaVersion: string; aiError: string;
  attempts: { id: string; requestId: string | null; provider: string; model: string; status: string; errorCode: string;
    latencyMs: number; inputTokens: number | null; outputTokens: number | null; actualUsd: number | null; createdAt: string }[];
  audit: { id: string; actor: string; action: string; createdAt: string; afterJson: string }[];
};

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Article | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<ArticleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function showDetail(article: Article) {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/articles/${encodeURIComponent(article.id)}/admin`, { cache: 'no-store' });
      if (!response.ok) throw new Error('detail-load-failed');
      const result = await response.json();
      setDetail(result.data);
    } catch { setMessage('Không tải được chi tiết bài viết'); }
    finally { setDetailLoading(false); }
  }

  async function reprocess(article: Article) {
    const reason = window.prompt('Lý do xử lý lại (ít nhất 8 ký tự):');
    if (!reason) return;
    const force = window.confirm('Bỏ cache và cho phép tạo generation mới khi worker chạy? Hủy để tái sử dụng cache.');
    await updateArticle(article.id, { action: 'reprocess', reviewReason: reason, force });
  }

  async function load() {
    setLoading(true);
    setError('');
    const url = new URL('/api/articles', window.location.origin);
    url.searchParams.set('pageSize', '50');
    if (status) url.searchParams.set('status', status);
    if (source) url.searchParams.set('source', source);
    if (category) url.searchParams.set('category', category);
    if (search) url.searchParams.set('search', search);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Load failed');
      }
      const data = await res.json();
      setArticles(data.data);
    } catch {
      setArticles([]);
      setError('Không tải được danh sách bài viết.');
    } finally {
      setLoading(false);
    }
  }

  async function updateArticle(slug: string, body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
    const res = await fetch(body.action === 'reprocess' ? `/api/admin/articles/${encodeURIComponent(slug)}/reprocess` : `/api/articles/${encodeURIComponent(slug)}`, {
      method: body.action === 'reprocess' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || 'Update failed');
      return;
    }
    setMessage('Đã cập nhật bài viết');
    setEditing(null);
    setDetail(null);
    await load();
    } catch { setMessage('Không kết nối được máy chủ'); }
    finally { setBusy(false); }
  }

  function confirmStatusChange(article: Article, nextStatus: 'published' | 'rejected') {
    const action = nextStatus === 'published' ? 'publish' : 'reject';
    if (window.confirm(`Xác nhận ${action} bài viết này?`)) {
      const reviewReason = window.prompt(nextStatus === 'published' ? 'Lý do duyệt; ghi rõ ngoại lệ evidence/quality nếu có (ít nhất 12 ký tự):' : 'Lý do từ chối:');
      if (reviewReason === null) return;
      void updateArticle(article.slug, { status: nextStatus, reviewReason, reviewOverride: nextStatus === 'published' && window.confirm('Xác nhận đã đọc bản gốc, kiểm tra đầu ra và chấp nhận ngoại lệ quality/evidence nếu có?') });
    }
  }

  function onFilter(event: FormEvent) {
    event.preventDefault();
    load();
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      const url = new URL('/api/articles', window.location.origin);
      url.searchParams.set('pageSize', '50');

      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('Load failed');
        }
        const data = await res.json();
        if (!cancelled) {
          setArticles(data.data);
        }
      } catch {
        if (!cancelled) {
          setArticles([]);
          setError('Không tải được danh sách bài viết.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold text-slate-950">Quản lý bài viết</h1>
      <form onSubmit={onFilter} className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Tất cả status</option>
          <option value="published">published</option>
          <option value="pending">pending</option>
          <option value="rejected">rejected</option>
          <option value="draft">draft</option>
        </select>
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Tất cả category</option>
          {newsCategories.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Lọc</button>
      </form>

      {message && <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}

      <div className="mt-5 grid gap-4">
        {loading && (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Đang tải danh sách bài viết...
          </p>
        )}

        {!loading && error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {!loading && !error && articles.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Không tìm thấy bài viết phù hợp.
          </p>
        )}

        {!loading && !error && articles.map((article) => (
          <div key={article.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">{article.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {article.sourceName} · {article.category} · {article.status} · điểm {article.importanceScore}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => confirmStatusChange(article, 'published')} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  Publish
                </button>
                <button disabled={busy} onClick={() => confirmStatusChange(article, 'rejected')} className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  Reject
                </button>
                <button onClick={() => setEditing(article)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">
                  Sửa
                </button>
                <button disabled={detailLoading} onClick={() => void showDetail(article)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Đối chiếu</button>
                {article.status !== 'published' && <button disabled={busy} onClick={() => void reprocess(article)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Xử lý lại</button>}
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{article.summaryVi}</p>
            <details className="mt-3 text-sm text-slate-600">
              <summary className="cursor-pointer font-medium">Lý do chấm điểm</summary>
              <p className="mt-2">{article.reasonForScore || 'N/A'}</p>
              <p className="mt-2 break-words text-xs">{article.scoreVersion || 'legacy'} · {article.evidenceLevel} · {article.processingReason || '-'}</p>
              <p className="mt-2 break-words text-xs">{article.processingStatus} · attempts {article.processingAttempts} · retry {article.nextRetryAt ? new Date(article.nextRetryAt).toLocaleString('vi-VN') : '-'}</p>
              {article.qualityFlags !== '[]' && <p className="mt-2 break-words text-xs text-amber-700">{article.qualityFlags}</p>}
              {article.eventKey && <p className="mt-2 break-words text-xs text-slate-500">Event: {article.eventKey} · suggested</p>}
            </details>
          </div>
        ))}
      </div>

      {detail && <div role="dialog" aria-modal="true" aria-label="Đối chiếu bài viết" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/30 p-3 sm:p-6">
        <section className="mx-auto max-w-6xl rounded-lg bg-white p-4 shadow-xl sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1 break-words text-lg font-bold">{detail.title}</h2>
            <button onClick={() => setDetail(null)} className="rounded border border-slate-300 px-3 py-2 text-sm">Đóng</button>
          </div>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div className="min-w-0">
              <h3 className="font-semibold">Bản gốc</h3>
              <p className="mt-2 break-words text-sm font-medium">{detail.originalTitle}</p>
              <p className="mt-2 break-words text-xs text-slate-500">{detail.evidenceLevel} · {detail.originalPublishedAt || 'unknown date'}</p>
              {/^https?:\/\//i.test(detail.originalUrl) && <a className="mt-2 block break-all text-sm text-sky-700" href={detail.originalUrl} target="_blank" rel="noopener noreferrer">{detail.originalUrl}</a>}
              <p className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6">{detail.originalText || 'Không có evidence gốc'}</p>
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">Biên tập AI</h3>
              <p className="mt-2 break-words text-sm font-medium">{detail.titleVi || '-'}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{detail.briefVi || detail.summaryVi || '-'}</p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{detail.whyImportant || '-'}</p>
              <p className="mt-3 break-words text-xs text-amber-800">{detail.qualityFlags} · {detail.aiError}</p>
              <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium">Claims / Uncertainties</summary><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all">{detail.aiClaims}{'\n'}{detail.aiUncertainties}</pre></details>
            </div>
          </div>
          <p className="mt-5 break-words text-xs text-slate-600">{detail.processingStatus} · {detail.processingReason} · {detail.promptVersion || 'legacy'} · {detail.schemaVersion || 'legacy'}</p>
          <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium">Score breakdown</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap break-all">{detail.scoreBreakdown}</pre></details>
          <div className="mt-5 overflow-x-auto border-y border-slate-200">
            <table className="w-full min-w-[780px] text-left text-xs"><caption className="py-2 text-left font-semibold">AI Attempts</caption>
              <thead><tr>{['Time / Request', 'Provider / Model', 'Status / Error', 'Latency', 'Input / Output tokens', 'USD'].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead>
              <tbody>{detail.attempts.map((attempt) => <tr key={attempt.id} className="border-t border-slate-200">
                <td className="max-w-48 break-all p-2">{attempt.createdAt}<br />{attempt.requestId || attempt.id}</td>
                <td className="max-w-48 break-all p-2">{attempt.provider}<br />{attempt.model}</td>
                <td className="p-2">{attempt.status}<br />{attempt.errorCode}</td><td className="p-2">{attempt.latencyMs} ms</td>
                <td className="p-2">{attempt.inputTokens ?? '?'} / {attempt.outputTokens ?? '?'}</td><td className="p-2">{attempt.actualUsd === null ? 'unknown' : attempt.actualUsd.toFixed(6)}</td>
              </tr>)}</tbody>
            </table>
            {!detail.attempts.length && <p className="p-2 text-xs text-slate-500">Chưa có attempt</p>}
          </div>
          <details className="mt-4 text-xs"><summary className="cursor-pointer font-medium">Audit</summary>{detail.audit.map((entry) => <div key={entry.id} className="mt-2 border-t border-slate-200 py-2"><p>{entry.createdAt} · {entry.actor} · {entry.action}</p><pre className="mt-1 whitespace-pre-wrap break-all">{entry.afterJson}</pre></div>)}</details>
        </section>
      </div>}

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-950/30 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              updateArticle(editing.slug, {
                summaryVi: form.get('summaryVi'),
                contentVi: form.get('contentVi'),
                category: form.get('category'),
                tags: form.get('tags'),
              });
            }}
            className="mx-auto mt-4 max-h-[90dvh] max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
          >
            <h2 className="text-xl font-bold text-slate-950">Sửa bài viết</h2>
            <label className="mt-4 block text-sm font-medium">
              Summary
              <textarea name="summaryVi" defaultValue={editing.summaryVi} className="mt-1 h-28 w-full rounded-md border border-slate-300 p-3" />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Content
              <textarea name="contentVi" defaultValue={editing.contentVi} className="mt-1 h-40 w-full rounded-md border border-slate-300 p-3" />
            </label>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-medium">
                Category
                <select name="category" defaultValue={editing.category} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                  {!newsCategories.includes(editing.category as typeof newsCategories[number]) && <option value={editing.category}>{editing.category}</option>}
                  {newsCategories.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Tags
                <input name="tags" defaultValue={editing.tags} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm">
                Hủy
              </button>
              <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Lưu</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
