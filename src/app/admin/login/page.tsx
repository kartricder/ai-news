'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(event.currentTarget);

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.get('username'),
        password: form.get('password'),
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Đăng nhập thất bại');
      return;
    }

    router.push('/admin');
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <form onSubmit={onSubmit} className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-950">Đăng nhập admin</h1>
        <p className="mt-2 text-sm text-slate-500">Dùng tài khoản cấu hình trong biến môi trường hoặc seed.</p>

        <label className="mt-6 block text-sm font-medium text-slate-700">
          Username
          <input name="username" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" required />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Password
          <input name="password" type="password" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" required />
        </label>

        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button disabled={loading} className="mt-6 w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
