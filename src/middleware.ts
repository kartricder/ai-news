import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /admin routes from public access
  if (pathname.startsWith('/admin')) {
    // Skip API auth routes
    if (pathname === '/api/admin/login' || pathname === '/admin/login') {
      return NextResponse.next();
    }

    // Check for auth token in cookies
    const authToken = request.cookies.get('auth_token')?.value;

    if (!authToken) {
      // Redirect to login page if accessing admin page
      if (!pathname.startsWith('/api/')) {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
      // Return 401 for API routes
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  // Set security headers on all responses
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    // Apply to /admin/* routes
    '/admin/:path*',
    '/api/admin/:path*',
  ],
};
