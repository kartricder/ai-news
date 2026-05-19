import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Navbar from '@/components/Navbar';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'AI News Việt Nam',
  description:
    'Tổng hợp tin tức công nghệ trí tuệ nhân tạo mới nhất, cập nhật hằng ngày về AI, Machine Learning và các xu hướng công nghệ.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white">
        <Navbar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4">{children}</main>
      </body>
    </html>
  );
}
