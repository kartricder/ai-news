// Simple JWT-like token for admin authentication
// Uses HMAC-SHA256 with a server-side secret

import crypto from 'crypto';

const JWT_SECRET = process.env.ENCRYPTION_KEY || 'default-secret-change-in-production';

export interface TokenPayload {
  username: string;
  role: string;
  iat: number;
  exp: number;
}

export function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 24 * 60 * 60; // 24 hours
  const fullPayload: TokenPayload = { ...payload, iat, exp };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const payload: TokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
