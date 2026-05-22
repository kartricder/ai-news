import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import './globals.css';

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: 'AI News Việt Nam',
  description:
    'Tổng hợp tin tức công nghệ trí tuệ nhân tạo mới nhất, cập nhật hằng ngày về AI, Machine Learning và các xu hướng công nghệ.',
  keywords: 'AI, trí tuệ nhân tạo, machine learning, LLM, tin tức công nghệ',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'AI News Việt Nam',
  },
  alternates: {
    types: {
      'application/rss+xml': [{ url: '/feed.xml', title: 'AI News Việt Nam RSS' }],
    },
  },
};

function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-indigo-600 text-xs font-extrabold text-white">
                AI
              </span>
              AI News Việt Nam
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Tổng hợp tin AI tự động từ các nguồn uy tín.
              Chấm điểm và xuất bản các tin quan trọng nhất.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Khám phá</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="text-slate-600 hover:text-sky-600">Tin mới nhất</Link></li>
              <li><Link href="/?sortBy=importanceScore" className="text-slate-600 hover:text-sky-600">Tin quan trọng</Link></li>
              <li><Link href="/repo-radar" className="text-slate-600 hover:text-sky-600">Repo Radar</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Nguồn tin</h4>
            <ul className="space-y-1 text-xs text-slate-500">
              <li>Hacker News</li>
              <li>Reddit r/LocalLLaMA, r/OpenAI</li>
              <li>GitHub Trending</li>
              <li>OpenAI, Anthropic, Google AI Blog</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Hệ thống</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/admin" className="text-slate-600 hover:text-sky-600">Admin Dashboard</Link></li>
              <li><Link href="/admin/crawl-logs" className="text-slate-600 hover:text-sky-600">Crawl Logs</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
          Dữ liệu cập nhật tự động · AI News Việt Nam &copy; {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
