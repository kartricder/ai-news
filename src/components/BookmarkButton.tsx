'use client';

import { useEffect, useState } from 'react';

export const BOOKMARK_STORAGE_KEY = 'ai_news_bookmarks';
const MAX_BOOKMARKS = 100;

export type BookmarkItem = {
  slug: string;
  titleVi: string;
  title: string;
  briefVi: string;
  sourceName: string;
  importanceScore: number;
  publishedAt: string | null;
  savedAt: string;
};

export type BookmarkInput = Omit<BookmarkItem, 'savedAt'>;

export function readBookmarks(): BookmarkItem[] {
  try {
    const raw = localStorage.getItem(BOOKMARK_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is BookmarkItem => (
      typeof item === 'object'
      && item !== null
      && typeof item.slug === 'string'
      && typeof item.title === 'string'
      && typeof item.titleVi === 'string'
      && typeof item.briefVi === 'string'
      && typeof item.sourceName === 'string'
      && typeof item.importanceScore === 'number'
      && (typeof item.publishedAt === 'string' || item.publishedAt === null)
      && typeof item.savedAt === 'string'
    ));
  } catch {
    return [];
  }
}

export function writeBookmarks(items: BookmarkItem[]) {
  try {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_BOOKMARKS)));
    return true;
  } catch {
    return false;
  }
}

export default function BookmarkButton({ article }: { article: BookmarkInput }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const existing = readBookmarks();
      setBookmarked(existing.some((item) => item.slug === article.slug));
      setStorageReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [article.slug]);

  function toggleBookmark() {
    const existing = readBookmarks();
    const isSaved = existing.some((item) => item.slug === article.slug);
    const next = isSaved
      ? existing.filter((item) => item.slug !== article.slug)
      : [{ ...article, savedAt: new Date().toISOString() }, ...existing.filter((item) => item.slug !== article.slug)];

    if (writeBookmarks(next)) {
      setBookmarked(!isSaved);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleBookmark}
      disabled={!storageReady}
      aria-pressed={bookmarked}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
        bookmarked
          ? 'border-sky-200 bg-sky-50 text-sky-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-700'
      }`}
    >
      <svg className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4a2 2 0 012-2h8a2 2 0 012 2v18l-6-4-6 4V4z" />
      </svg>
      {bookmarked ? 'Đã lưu' : 'Lưu lại'}
    </button>
  );
}
