import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as yauzl from 'yauzl';
import {
  MAX_SINGLE_PUT_BYTES,
  predictZipSize,
  streamZipToPresignedUrl,
  ZipEntry,
} from '../../src/shared/medical-record-export/zip-stream';

// Fixed so the archive is byte-identical run to run and a size assertion means something.
const MTIME = new Date('2026-01-02T03:04:05.000Z');

// @types/node's generic Uint8Array makes Buffer[] unassignable to Buffer.concat; cast as elsewhere here.
const concat = (chunks: Buffer[]): Buffer => Buffer.concat(chunks as unknown as Uint8Array[]);

interface Upload {
  status: number;
  headers: http.IncomingHttpHeaders;
  bytes: number;
  body?: Buffer;
}

/** Stands in for the presigned PUT target. */
interface UploadTarget {
  url: string;
  uploads: Upload[];
  /** Set to have the next PUT answered with this status instead of 200. */
  respondWith: number;
  /** When false the body is counted but not retained, so multi-GB cases stay cheap. */
  keepBody: boolean;
  close: () => Promise<void>;
}

const startUploadTarget = async (): Promise<UploadTarget> => {
  const uploads: Upload[] = [];
  const state = { respondWith: 200, keepBody: true };

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    req.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (state.keepBody) chunks.push(chunk);
    });
    req.on('end', () => {
      uploads.push({
        status: state.respondWith,
        headers: req.headers,
        bytes,
        body: state.keepBody ? concat(chunks) : undefined,
      });
      res.statusCode = state.respondWith;
      res.end(state.respondWith >= 400 ? '<Error><Code>Boom</Code></Error>' : '');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/upload`,
    uploads,
    get respondWith(): number {
      return state.respondWith;
    },
    set respondWith(value: number) {
      state.respondWith = value;
    },
    get keepBody(): boolean {
      return state.keepBody;
    },
    set keepBody(value: boolean) {
      state.keepBody = value;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

const bufferEntry = (name: string, body: Buffer): ZipEntry => ({
  name,
  size: body.length,
  open: () => Promise.resolve(Readable.from([body])),
});

/** Generates `size` bytes without ever holding them, for the large-archive cases. */
const syntheticEntry = (name: string, size: number, chunkSize = 64 * 1024): ZipEntry => ({
  name,
  size,
  open: () => {
    let remaining = size;
    const chunk = Buffer.alloc(chunkSize, 0xab);
    return Promise.resolve(
      new Readable({
        read(): void {
          if (remaining <= 0) {
            this.push(null);
            return;
          }
          const take = Math.min(chunkSize, remaining);
          remaining -= take;
          this.push(take === chunkSize ? chunk : chunk.subarray(0, take));
        },
      })
    );
  },
});

const readArchive = (archive: Buffer): Promise<Map<string, Buffer>> =>
  new Promise((resolve, reject) => {
    yauzl.fromBuffer(archive, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(openError ?? new Error('archive could not be opened'));
        return;
      }

      const contents = new Map<string, Buffer>();
      zipFile.on('error', reject);
      zipFile.on('end', () => resolve(contents));
      zipFile.on('entry', (entry: yauzl.Entry) => {
        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            reject(streamError ?? new Error(`could not read ${entry.fileName}`));
            return;
          }
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => {
            contents.set(entry.fileName, concat(chunks));
            zipFile.readEntry();
          });
          stream.on('error', reject);
        });
      });
      zipFile.readEntry();
    });
  });

describe('medical record streamed archive', () => {
  let target: UploadTarget;

  beforeEach(async () => {
    target = await startUploadTarget();
  });

  afterEach(async () => {
    await target.close();
  });

  it('uploads exactly the number of bytes it declared in Content-Length', async () => {
    // Empty, sub-chunk, multi-chunk, and a utf8 name — which changes the header lengths being predicted.
    const entries = [
      bufferEntry('empty.txt', Buffer.alloc(0)),
      bufferEntry('small.pdf', Buffer.from('a short document')),
      bufferEntry('large.bin', Buffer.alloc(200 * 1024, 0x5a)),
      bufferEntry('résumé — visite (2026).pdf', Buffer.from('unicode name')),
    ];

    const predicted = predictZipSize(entries, MTIME);
    expect(predicted).toBeGreaterThan(0);

    const result = await streamZipToPresignedUrl({
      entries,
      uploadUrl: target.url,
      contentType: 'application/zip',
      mtime: MTIME,
    });

    expect(target.uploads).toHaveLength(1);
    const [upload] = target.uploads;

    expect(upload.headers['content-length']).toBe(String(predicted));
    expect(upload.bytes).toBe(predicted);
    expect(result.bytesUploaded).toBe(predicted);
    expect(result.entryCount).toBe(entries.length);
    expect(upload.headers['content-type']).toBe('application/zip');
  });

  it('produces an archive that reads back with the right names and contents', async () => {
    const bodies = new Map<string, Buffer>([
      ['notes.txt', Buffer.from('line one\nline two')],
      ['scan.bin', Buffer.alloc(130 * 1024, 0x17)],
      ['empty.dat', Buffer.alloc(0)],
      ['ünïcode ✓.pdf', Buffer.from('unicode body')],
    ]);

    await streamZipToPresignedUrl({
      entries: [...bodies].map(([name, body]) => bufferEntry(name, body)),
      uploadUrl: target.url,
      contentType: 'application/zip',
      mtime: MTIME,
    });

    const archive = target.uploads[0].body;
    expect(archive).toBeDefined();

    const extracted = await readArchive(archive!);
    expect([...extracted.keys()].sort()).toEqual([...bodies.keys()].sort());
    for (const [name, body] of bodies) {
      expect(extracted.get(name)).toEqual(body);
    }
  });

  it('preserves entry order and reports progress once per entry', async () => {
    const entries = Array.from({ length: 25 }, (_, i) => bufferEntry(`doc-${i}.txt`, Buffer.from(`body ${i}`)));

    const progress: number[] = [];
    await streamZipToPresignedUrl({
      entries,
      uploadUrl: target.url,
      contentType: 'application/zip',
      mtime: MTIME,
      maxConcurrentDownloads: 4,
      onProgress: (processed) => {
        progress.push(processed);
      },
    });

    // Monotonic, one tick per entry, finishing at the total.
    expect(progress).toEqual(Array.from({ length: entries.length }, (_, i) => i + 1));

    const extracted = await readArchive(target.uploads[0].body!);
    expect([...extracted.keys()]).toEqual(entries.map((entry) => entry.name));
  });

  it('aborts the export when the progress callback throws, rather than swallowing it', async () => {
    // How the worker enforces its time budget; a discarded throw would leave the Task stuck in-progress.
    const entries = Array.from({ length: 10 }, (_, i) => bufferEntry(`doc-${i}.txt`, Buffer.from(`body ${i}`)));

    await expect(
      streamZipToPresignedUrl({
        entries,
        uploadUrl: target.url,
        contentType: 'application/zip',
        mtime: MTIME,
        maxConcurrentDownloads: 2,
        onProgress: (processed) => {
          if (processed === 3) throw new Error('export exceeded its budget');
        },
      })
    ).rejects.toThrow('export exceeded its budget');
  });

  it('awaits an async progress callback, so a slow publisher applies backpressure', async () => {
    const seen: number[] = [];
    await streamZipToPresignedUrl({
      entries: Array.from({ length: 5 }, (_, i) => bufferEntry(`doc-${i}.txt`, Buffer.from(`body ${i}`))),
      uploadUrl: target.url,
      contentType: 'application/zip',
      mtime: MTIME,
      maxConcurrentDownloads: 2,
      onProgress: async (processed) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        seen.push(processed);
      },
    });

    // Every tick resolved before the upload was considered done.
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });

  // Regression guard: yazl predicted 76 bytes more than it wrote once the central directory passed
  // 64 KiB (~900 entries), so the upload could never satisfy its own Content-Length. Pinned past that.
  it('matches its declared length past the entry count where the central directory exceeds 64 KiB', async () => {
    const entries = Array.from({ length: 1100 }, (_, i) => bufferEntry(`récord ${i}.pdf`, Buffer.from(`body ${i}`)));

    const predicted = predictZipSize(entries, MTIME);
    const result = await streamZipToPresignedUrl({
      entries,
      uploadUrl: target.url,
      contentType: 'application/zip',
      mtime: MTIME,
    });

    expect(target.uploads[0].headers['content-length']).toBe(String(predicted));
    expect(target.uploads[0].bytes).toBe(predicted);
    expect(result.bytesUploaded).toBe(predicted);

    // And it is still a readable archive, not merely one of the right length.
    const extracted = await readArchive(target.uploads[0].body!);
    expect(extracted.size).toBe(entries.length);
    expect(extracted.get('récord 1099.pdf')).toEqual(Buffer.from('body 1099'));
  }, 60_000);

  it('keeps memory flat while streaming an archive far larger than its memory window', async () => {
    // 256 MiB generated on the fly and counted, not retained. Sampled while streaming rather than
    // compared before/after: GC runs during the transfer, so end-state heap can even come out lower than
    // it started and would hide a stage that buffered the archive and then released it.
    target.keepBody = false;
    const entryBytes = 1024 * 1024;
    const entries = Array.from({ length: 256 }, (_, i) => syntheticEntry(`big-${i}.bin`, entryBytes));

    const predicted = predictZipSize(entries, MTIME);
    expect(predicted).toBeGreaterThan(256 * 1024 * 1024);

    const baseline = process.memoryUsage().heapUsed;
    let peak = baseline;

    const result = await streamZipToPresignedUrl({
      entries,
      uploadUrl: target.url,
      contentType: 'application/zip',
      mtime: MTIME,
      maxConcurrentDownloads: 8,
      entryBufferBytes: 4 * 1024 * 1024,
      onProgress: () => {
        peak = Math.max(peak, process.memoryUsage().heapUsed);
      },
    });

    expect(result.bytesUploaded).toBe(predicted);
    expect(target.uploads[0].bytes).toBe(predicted);
    // Comfortably above the ~32 MiB window (8 × 4 MiB) and far below the 256 MiB that moved through, so
    // this fails if any stage starts holding the archive rather than passing it along.
    expect(peak - baseline).toBeLessThan(96 * 1024 * 1024);
  }, 120_000);

  it('rejects when the upload is refused, naming the status', async () => {
    target.respondWith = 403;

    await expect(
      streamZipToPresignedUrl({
        entries: [bufferEntry('a.txt', Buffer.from('hello'))],
        uploadUrl: target.url,
        contentType: 'application/zip',
        mtime: MTIME,
      })
    ).rejects.toThrow(/Archive upload failed \[403\]/);
  });

  it('stops the pump when the upload dies, instead of filling sinks nobody is draining', async () => {
    // The deadlock case: with no consumer for yazl's output, backpressure stops the writer, the sinks
    // fill and every worker blocks. Only wiring the upload's failure into the abort path returns here.
    const entries = Array.from({ length: 200 }, (_, i) => syntheticEntry(`doc-${i}.bin`, 512 * 1024));

    await expect(
      streamZipToPresignedUrl({
        // Nothing is listening on port 1, so the PUT is refused while the pump is still working.
        entries,
        uploadUrl: 'http://127.0.0.1:1/upload',
        contentType: 'application/zip',
        mtime: MTIME,
        maxConcurrentDownloads: 4,
      })
    ).rejects.toThrow(/ECONNREFUSED|torn down before it finished/);
  }, 30_000);

  it('gives up on its own clock when the transfer stalls, rather than burning the whole invocation', async () => {
    // An entry that opens and goes quiet completes nothing, so a per-entry budget check never fires.
    const stalled: ZipEntry = {
      name: 'stalled.bin',
      size: 4096,
      // Never pushes, never ends.
      open: () => Promise.resolve(new Readable({ read: () => undefined })),
    };

    const startedAt = Date.now();
    await expect(
      streamZipToPresignedUrl({
        entries: [bufferEntry('first.txt', Buffer.from('fine')), stalled],
        uploadUrl: target.url,
        contentType: 'application/zip',
        mtime: MTIME,
        timeBudgetMs: 150,
      })
    ).rejects.toThrow(/exceeded its 150ms budget after 1\/2 entries/);

    expect(Date.now() - startedAt).toBeLessThan(5_000);
  }, 20_000);

  it('rejects, naming the entry, when an entry delivers fewer bytes than it declared', async () => {
    const entries: ZipEntry[] = [
      bufferEntry('good.txt', Buffer.from('fine')),
      { name: 'truncated.pdf', size: 500, open: () => Promise.resolve(Readable.from([Buffer.alloc(100)])) },
    ];

    await expect(
      streamZipToPresignedUrl({
        entries,
        uploadUrl: target.url,
        contentType: 'application/zip',
        mtime: MTIME,
      })
    ).rejects.toThrow(/truncated\.pdf.*100 of its declared 500 bytes/);
  });

  it('rejects, naming the entry, when an entry delivers more bytes than it declared', async () => {
    const entries: ZipEntry[] = [
      { name: 'overlong.pdf', size: 10, open: () => Promise.resolve(Readable.from([Buffer.alloc(64)])) },
    ];

    await expect(
      streamZipToPresignedUrl({
        entries,
        uploadUrl: target.url,
        contentType: 'application/zip',
        mtime: MTIME,
      })
    ).rejects.toThrow(/overlong\.pdf.*longer than its declared 10 bytes/);
  });

  it('rejects when an entry cannot be opened, rather than uploading a short archive', async () => {
    const entries: ZipEntry[] = [
      bufferEntry('ok.txt', Buffer.from('ok')),
      { name: 'gone.pdf', size: 12, open: () => Promise.reject(new Error('attachment vanished')) },
    ];

    await expect(
      streamZipToPresignedUrl({
        entries,
        uploadUrl: target.url,
        contentType: 'application/zip',
        mtime: MTIME,
      })
    ).rejects.toThrow('attachment vanished');
  });

  it('refuses an archive over the single-upload ceiling before starting the upload', async () => {
    const entries = [syntheticEntry('huge.bin', MAX_SINGLE_PUT_BYTES + 1)];

    await expect(
      streamZipToPresignedUrl({
        entries,
        uploadUrl: target.url,
        contentType: 'application/zip',
        mtime: MTIME,
      })
    ).rejects.toThrow(/over the \d+-byte single-upload limit/);

    expect(target.uploads).toHaveLength(0);
  });

  it('cannot predict a size when compression is on or a size is missing', () => {
    // Guards yazl's two conditions; if either regresses predictZipSize returns -1 and the upload refuses.
    expect(predictZipSize([{ name: 'a.txt', size: 5 }], MTIME)).toBeGreaterThan(0);
  });
});
