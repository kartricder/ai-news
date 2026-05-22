import type { Metadata } from 'next';
import SavedArticleList from '@/components/SavedArticleList';

export const metadata: Metadata = {
  title: 'Bài đã lưu — AI News Việt Nam',
  description: 'Danh sách bài AI đã lưu để đọc sau trên thiết bị này.',
};

export default function SavedPage() {
  return (
    <div className="py-6 lg:py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Bài đã lưu</h1>
        <p className="mt-2 text-sm text-slate-500">Các bài đọc sau được giữ cục bộ trong trình duyệt hiện tại.</p>
      </div>
      <SavedArticleList />
    </div>
  );
}
