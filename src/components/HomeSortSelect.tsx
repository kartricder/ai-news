'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type HomeSort = 'importanceScore' | 'createdAt';

export default function HomeSortSelect({ value }: { value: HomeSort }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function changeSort(sortBy: HomeSort) {
    const params = new URLSearchParams(searchParams.toString());
    if (sortBy === 'importanceScore') {
      params.delete('sortBy');
    } else {
      params.set('sortBy', sortBy);
    }
    params.delete('page');

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <select
      value={value}
      onChange={(event) => changeSort(event.target.value as HomeSort)}
      aria-label="Sắp xếp bài viết"
      className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-600 focus:border-sky-300 focus:outline-none"
    >
      <option value="importanceScore">Quan trọng nhất</option>
      <option value="createdAt">Mới nhất</option>
    </select>
  );
}
