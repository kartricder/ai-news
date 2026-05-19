import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';

export function getAdminPayloadFromRequest(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') return null;
  return payload;
}

export function requireAdminApi(request: NextRequest): NextResponse | null {
  if (getAdminPayloadFromRequest(request)) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function requireAdminPage() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    redirect('/admin/login');
  }
  return payload;
}
