import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import ipaddr from 'ipaddr.js';

export class SourceFetchError extends Error {
  constructor(public code: string, public httpStatus?: number, public retryAfterMs?: number) {
    super(code);
  }
}

class Semaphore {
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private limit: number) {}
  async acquire(signal: AbortSignal): Promise<() => void> {
    while (this.active >= this.limit) {
      await new Promise<void>((resolve, reject) => {
        const resume = () => { signal.removeEventListener('abort', abort); resolve(); };
        const abort = () => { this.waiting = this.waiting.filter((entry) => entry !== resume); reject(new SourceFetchError('timeout')); };
        this.waiting.push(resume);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      });
    }
    signal.throwIfAborted();
    this.active++;
    return () => { this.active--; this.waiting.shift()?.(); };
  }
}

const globalLimit = new Semaphore(3);
const hosts = new Map<string, Semaphore>();
const nextRequestAt = new Map<string, number>();

export function validateSourceUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new SourceFetchError('invalid-url'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new SourceFetchError('unsafe-url');
  if (url.port && !['80', '443'].includes(url.port)) throw new SourceFetchError('unsafe-port');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) throw new SourceFetchError('private-host');
  if (isIP(hostname)) assertPublicAddress(hostname);
  return url;
}

function assertPublicAddress(address: string) {
  const parsed = ipaddr.process(address);
  if (parsed.range() !== 'unicast') throw new SourceFetchError('private-or-reserved-address');
}

export type SafeResponse = {
  url: string;
  status: number;
  headers: http.IncomingHttpHeaders;
  text: string;
  durationMs: number;
};

export function retryAfterMilliseconds(value: string | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const duration = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now;
  return Number.isFinite(duration) ? Math.min(86_400_000, Math.max(0, duration)) : undefined;
}

export async function safeFetch(value: string, options: {
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  authHost?: string;
} = {}): Promise<SafeResponse> {
  const started = Date.now();
  const signal = AbortSignal.timeout(Math.max(1000, Math.min(options.timeoutMs ?? 10_000, 30_000)));
  const maxBytes = Math.min(options.maxBytes ?? 2 * 1024 * 1024, 2 * 1024 * 1024);
  let url = validateSourceUrl(value);
  try {
    for (let redirect = 0; redirect <= 3; redirect++) {
      const hostname = url.hostname.replace(/^\[|\]$/g, '');
      const addresses = isIP(hostname)
        ? [{ address: hostname, family: isIP(hostname) }]
        : await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
          const abort = () => reject(new SourceFetchError('timeout'));
          signal.addEventListener('abort', abort, { once: true });
          lookup(hostname, { all: true, verbatim: true }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
          if (signal.aborted) abort();
        });
      if (!addresses.length) throw new SourceFetchError('dns-empty');
      addresses.forEach((entry) => assertPublicAddress(entry.address));
      const address = addresses.find((entry) => entry.family === 4) || addresses[0];
      const hostLimit = hosts.get(hostname) || new Semaphore(1);
      hosts.set(hostname, hostLimit);
      const releaseHost = await hostLimit.acquire(signal);
      let releaseGlobal: (() => void) | undefined;
      let response: SafeResponse;
      try {
        if (hostname === 'export.arxiv.org' || hostname === 'api.github.com') {
          const wait = Math.max(0, (nextRequestAt.get(hostname) || 0) - Date.now());
          if (wait) await delay(wait, undefined, { signal });
          nextRequestAt.set(hostname, Date.now() + (hostname === 'export.arxiv.org' ? 3100 : url.pathname.startsWith('/search/') ? 6100 : 1100));
        }
        releaseGlobal = await globalLimit.acquire(signal);
        response = await new Promise<SafeResponse>((resolve, reject) => {
          const headers: Record<string, string> = {
            'User-Agent': 'AI-News/1.0 (+source-reader)',
            Accept: 'application/rss+xml, application/atom+xml, application/json, text/html, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            ...options.headers,
          };
          for (const key of Object.keys(headers)) {
            if (['authorization', 'cookie', 'proxy-authorization'].includes(key.toLowerCase()) &&
                (url.protocol !== 'https:' || url.hostname !== options.authHost)) delete headers[key];
          }
          const request = (url.protocol === 'https:' ? https : http).request(url, {
            method: 'GET', headers, signal, agent: false,
            lookup: (_name, settings, callback) => callback(null, settings.all ? [{ address: address.address, family: address.family }] : address.address, address.family),
          }, async (incoming) => {
            try {
              const status = incoming.statusCode || 0;
              if (status === 304 || [301, 302, 303, 307, 308].includes(status)) {
                incoming.destroy();
                resolve({ url: url.toString(), status, headers: incoming.headers, text: '', durationMs: Date.now() - started });
                return;
              }
              if (Number(incoming.headers['content-length'] || 0) > maxBytes) throw new SourceFetchError('body-too-large');
              let compressedBytes = 0;
              incoming.on('data', (chunk: Buffer) => {
                compressedBytes += chunk.length;
                if (compressedBytes > maxBytes) incoming.destroy(new SourceFetchError('body-too-large'));
              });
              const encoding = incoming.headers['content-encoding'];
              let body: Readable = incoming;
              const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'br' ? createBrotliDecompress() : encoding === 'deflate' ? createInflate() : null;
              if (decoder) {
                incoming.on('error', (error) => decoder.destroy(error));
                body = incoming.pipe(decoder);
              } else if (encoding && encoding !== 'identity') throw new SourceFetchError('unsupported-encoding');
              const chunks: Buffer[] = [];
              let bytes = 0;
              for await (const chunk of body) {
                const buffer = Buffer.from(chunk);
                bytes += buffer.length;
                if (bytes > maxBytes) throw new SourceFetchError('body-too-large');
                chunks.push(buffer);
              }
              resolve({ url: url.toString(), status, headers: incoming.headers, text: Buffer.concat(chunks).toString('utf8'), durationMs: Date.now() - started });
            } catch (error) { incoming.destroy(); reject(error); }
          });
          request.on('error', reject);
          request.end();
        });
      } finally { releaseGlobal?.(); releaseHost(); }
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      if (redirect === 3 || !response.headers.location) throw new SourceFetchError('redirect-limit');
      const next = validateSourceUrl(new URL(response.headers.location, url).toString());
      if (url.protocol === 'https:' && next.protocol !== 'https:') throw new SourceFetchError('https-downgrade');
      url = next;
    }
    throw new SourceFetchError('redirect-limit');
  } catch (error) {
    if (error instanceof SourceFetchError) throw error;
    throw new SourceFetchError(signal.aborted ? 'timeout' : 'network-or-dns-error');
  }
}