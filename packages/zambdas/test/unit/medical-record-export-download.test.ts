import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOWNLOAD_ATTEMPTS, openAttachmentStream } from '../../src/shared/medical-record-export/download';

const NO_DELAY = (): number => 0;

const read = async (stream: Readable): Promise<string> => {
  const chunks: string[] = [];
  for await (const chunk of stream) chunks.push(String(chunk));
  return chunks.join('');
};

const open = (
  presign: (url: string) => Promise<string> = (url) => Promise.resolve(`https://signed/${url}`)
): Promise<Readable> =>
  openAttachmentStream({ url: 'z3://bucket/doc.pdf', name: 'doc.pdf', presign, retryDelayMs: NO_DELAY });

describe('opening a document for the archive', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns the document bytes as a stream', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('the document')))
    );

    expect(await read(await open())).toBe('the document');
  });

  it('retries a transient failure instead of discarding the whole archive', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(new Response('recovered'));
    vi.stubGlobal('fetch', fetchMock);

    expect(await read(await open())).toBe('recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a failing presign too, since that is its own round trip', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('ok')))
    );
    const presign = vi
      .fn<(url: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('presign 503'))
      .mockResolvedValue('https://signed/retry');

    expect(await read(await open(presign))).toBe('ok');
    expect(presign).toHaveBeenCalledTimes(2);
  });

  it('retries a non-2xx response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    expect(await read(await open())).toBe('ok');
  });

  it('gives up after a bounded number of attempts, naming the document', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('nope', { status: 500 })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(open()).rejects.toThrow(/Download failed \[500\] for archive entry "doc\.pdf"/);
    expect(fetchMock).toHaveBeenCalledTimes(DOWNLOAD_ATTEMPTS);
  });

  it('signs a fresh url on every attempt, so an expired signature is not retried as-is', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('expired', { status: 403 }))
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const presign = vi.fn((url: string) =>
      Promise.resolve(`https://signed/${url}?attempt=${presign.mock.calls.length}`)
    );

    await read(await open(presign));

    expect(presign).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).not.toBe(fetchMock.mock.calls[1][0]);
  });

  it('only ever retries before bytes flow, so a partial entry cannot be duplicated', async () => {
    const body = new Response('first half');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(body))
    );

    const stream = await open();
    stream.destroy(new Error('connection reset mid-transfer'));

    await expect(read(stream)).rejects.toThrow('connection reset mid-transfer');
  });
});
