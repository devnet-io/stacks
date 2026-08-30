import type { StackOverview } from '../../../src/application/overview.ts';

export function localApiOrigin(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3210';
  const requested = new URLSearchParams(window.location.search).get('api');
  if (!requested) return 'http://127.0.0.1:3210';
  try {
    const url = new URL(requested);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
      return 'http://127.0.0.1:3210';
    }
    return url.origin;
  } catch {
    return 'http://127.0.0.1:3210';
  }
}

export async function fetchOverview(signal?: AbortSignal): Promise<StackOverview> {
  const response = await fetch(`${localApiOrigin()}/api/v0.1/overview`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  const body = await response.json() as StackOverview | { error?: string };
  if (!response.ok) throw new Error('error' in body && body.error ? body.error : `Local API returned ${response.status}.`);
  if (!('schemaVersion' in body) || body.schemaVersion !== '0.1' || !('stack' in body)) {
    throw new Error('The local API returned an unsupported overview contract.');
  }
  return body;
}
