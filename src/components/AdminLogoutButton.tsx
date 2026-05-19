'use client';

import { useRouter } from 'next/navigation';

export default function AdminLogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <button onClick={logout} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
      Logout
    </button>
  );
}
