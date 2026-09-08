import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NamedAttachment } from '../../src/shared/medical-record-export/naming';
import { resolveAttachmentSizes } from '../../src/shared/medical-record-export/sizes';

const attachment = (name: string, url = `z3://bucket/${name}`, size?: number): NamedAttachment => ({
  name,
  url,
  size,
});

/** A 206 the way S3 answers `Range: bytes=0-0`. */
const rangeResponse = (total: number): Response =>
  new Response(new Uint8Array([0]), {
    status: 206,
    headers: { 'content-range': `bytes 0-0/${total}` },
  });

describe('resolveAttachmentSizes', () => {
  const presign = (url: string): Promise<string> =>
    Promise.resolve(`https://signed.example/${encodeURIComponent(url)}`);

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reads each object length from Content-Range and totals them', async () => {
    const sizes: Record<string, number> = { 'a.pdf': 1234, 'b.pdf': 10, 'c.pdf': 999_999 };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const name = Object.keys(sizes).find((key) => decodeURIComponent(url).includes(key))!;
        return Promise.resolve(rangeResponse(sizes[name]));
      })
    );

    const result = await resolveAttachmentSizes({
      attachments: [attachment('a.pdf'), attachment('b.pdf'), attachment('c.pdf')],
      presign,
      concurrency: 2,
    });

    expect(result.entries.map((entry) => [entry.name, entry.size])).toEqual([
      ['a.pdf', 1234],
      ['b.pdf', 10],
      ['c.pdf', 999_999],
    ]);
    expect(result.totalBytes).toBe(1234 + 10 + 999_999);
    expect(result.skipped).toEqual([]);
    // The Z3 url comes back, not the presigned one used to measure — a big export outlives a signature.
    expect(result.entries.map((entry) => entry.url)).toEqual([
      'z3://bucket/a.pdf',
      'z3://bucket/b.pdf',
      'z3://bucket/c.pdf',
    ]);
  });

  it('issues a ranged GET, not a HEAD, because the url is signed for GET', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(rangeResponse(5)));
    vi.stubGlobal('fetch', fetchMock);

    await resolveAttachmentSizes({ attachments: [attachment('a.pdf')], presign, concurrency: 1 });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Range).toBe('bytes=0-0');
    expect(init.method).toBeUndefined();
  });

  it('treats a 416 as a zero-length object rather than a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 416 })))
    );

    const result = await resolveAttachmentSizes({ attachments: [attachment('empty.pdf')], presign, concurrency: 1 });

    expect(result.entries).toEqual([{ name: 'empty.pdf', size: 0, url: 'z3://bucket/empty.pdf' }]);
    expect(result.skipped).toEqual([]);
  });

  it('measures the delivered body when the range was ignored', async () => {
    // A 200 means the whole object came back; what arrived is a better answer than any header.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(new Uint8Array(7), { status: 200 })))
    );

    const result = await resolveAttachmentSizes({ attachments: [attachment('a.pdf')], presign, concurrency: 1 });

    expect(result.entries[0].size).toBe(7);
  });

  it('drops an attachment it cannot measure, keeping the rest of the export', async () => {
    // The only place a bad file can be dropped: once the archive length is committed, a failure has
    // to fail the whole upload.
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          decodeURIComponent(url).includes('gone.pdf') ? new Response('nope', { status: 404 }) : rangeResponse(42)
        )
      )
    );

    const result = await resolveAttachmentSizes({
      attachments: [attachment('good.pdf'), attachment('gone.pdf'), attachment('also-good.pdf')],
      presign,
      concurrency: 3,
    });

    expect(result.entries.map((entry) => entry.name)).toEqual(['good.pdf', 'also-good.pdf']);
    expect(result.skipped).toEqual([
      { name: 'gone.pdf', url: 'z3://bucket/gone.pdf', reason: 'size probe failed [404]' },
    ]);
    expect(result.totalBytes).toBe(84);
  });

  it('drops an attachment whose presign fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(rangeResponse(1)))
    );

    const result = await resolveAttachmentSizes({
      attachments: [attachment('a.pdf')],
      presign: () => Promise.reject(new Error('no access')),
      concurrency: 1,
    });

    expect(result.entries).toEqual([]);
    expect(result.skipped[0].reason).toContain('could not presign');
  });

  it('drops an attachment when the probe throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('socket hang up')))
    );

    const result = await resolveAttachmentSizes({ attachments: [attachment('a.pdf')], presign, concurrency: 1 });

    expect(result.entries).toEqual([]);
    expect(result.skipped[0].reason).toContain('socket hang up');
  });

  it('prefers the object store over a disagreeing FHIR size, and says so', async () => {
    // The store's length is what the archive's Content-Length must match, so it wins; the mismatch is
    // still worth a log line because it means the DocumentReference is wrong.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(rangeResponse(500)))
    );

    const result = await resolveAttachmentSizes({
      attachments: [attachment('a.pdf', 'z3://bucket/a.pdf', 300)],
      presign,
      concurrency: 1,
    });

    expect(result.entries[0].size).toBe(500);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('records size 300 but the object is 500 bytes'));
  });

  it('handles an empty chart without probing anything', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveAttachmentSizes({ attachments: [], presign, concurrency: 20 });

    expect(result).toEqual({ entries: [], skipped: [], totalBytes: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
