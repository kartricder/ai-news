'use client';

import { FormEvent, useEffect, useState } from 'react';

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
    setMessage('');
    const res = await fetch(`/api/articles/${slug}`, {
      method: 'PATCH',
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
    await load();
  }

  function confirmStatusChange(article: Article, nextStatus: 'published' | 'rejected') {
    const action = nextStatus === 'published' ? 'publish' : 'reject';
    if (window.confirm(`Xác nhận ${action} bài viết này?`)) {
      void updateArticle(article.slug, { status: nextStatus });
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
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
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
                <button onClick={() => confirmStatusChange(article, 'published')} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
                  Publish
                </button>
                <button onClick={() => confirmStatusChange(article, 'rejected')} className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white">
                  Reject
                </button>
                <button onClick={() => setEditing(article)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">
                  Sửa
                </button>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{article.summaryVi}</p>
            <details className="mt-3 text-sm text-slate-600">
              <summary className="cursor-pointer font-medium">Lý do chấm điểm</summary>
              <p className="mt-2">{article.reasonForScore || 'N/A'}</p>
            </details>
          </div>
        ))}
      </div>

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
            className="mx-auto mt-10 max-w-3xl rounded-lg bg-white p-5 shadow-xl"
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
                <input name="category" defaultValue={editing.category} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
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
