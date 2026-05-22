'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import ScoreBadge from '@/components/ui/ScoreBadge';
import { readBookmarks, writeBookmarks, type BookmarkItem } from '@/components/BookmarkButton';

function savedLabel(savedAt: string) {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return 'Vừa lưu';
  return `Lưu ${date.toLocaleString('vi-VN')}`;
}

export default function SavedArticleList() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBookmarks(readBookmarks());
      setReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function remove(slug: string) {
    const next = bookmarks.filter((item) => item.slug !== slug);
    if (writeBookmarks(next)) {
      setBookmarks(next);
    }
  }

  function clearAll() {
    if (!window.confirm('Xóa toàn bộ bài đã lưu trên thiết bị này?')) return;
    if (writeBookmarks([])) {
      setBookmarks([]);
    }
  }

  if (!ready) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Đang tải bài đã lưu...
      </p>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <EmptyState
        title="Bạn chưa lưu bài nào"
        description="Mở một bài viết và nhấn nút Lưu lại để đọc sau trên thiết bị này."
        action={
          <Link href="/" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Xem bài mới
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{bookmarks.length} bài · Lưu trên thiết bị này</p>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Xóa tất cả
        </button>
      </div>

      <div className="grid gap-4">
        {bookmarks.map((bookmark) => (
          <article key={bookmark.slug} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <ScoreBadge score={bookmark.importanceScore} />
                  <span className="text-xs text-slate-400">{bookmark.sourceName}</span>
                  <span className="text-xs text-slate-400">{savedLabel(bookmark.savedAt)}</span>
                </div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {bookmark.titleVi || bookmark.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{bookmark.briefVi}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/articles/${bookmark.slug}`}
                className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
              >
                Xem bài
              </Link>
              <button
                type="button"
                onClick={() => remove(bookmark.slug)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Xóa
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
