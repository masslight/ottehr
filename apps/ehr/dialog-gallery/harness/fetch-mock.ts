import type { FetchMock } from './story';

declare global {
  interface Window {
    __unmatched: string[];
  }
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Replaces window.fetch: same-origin requests pass through, everything else is answered from `mocks`. */
export function installFetchMock(mocks: FetchMock[]): void {
  const realFetch = window.fetch.bind(window);
  window.__unmatched = [];
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (
      url.startsWith('/') ||
      url.startsWith(window.location.origin) ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    ) {
      return realFetch(input, init);
    }
    let body: any = init?.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // leave as string
      }
    }
    const hit = mocks.find(
      (m) =>
        (!m.method || m.method.toUpperCase() === method) &&
        (typeof m.url === 'string' ? url.includes(m.url) : m.url.test(url))
    );
    if (hit) {
      const res = typeof hit.response === 'function' ? (hit.response as any)({ url, method, body }) : hit.response;
      return json(await res, hit.status ?? 200);
    }
    window.__unmatched.push(`${method} ${url}`);
    console.warn('[gallery] unmatched request', method, url);
    if (url.includes('/fhir')) return json({ resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] });
    if (url.includes('/zambda')) return json({ status: 200, output: {} });
    return json({});
  };
}
