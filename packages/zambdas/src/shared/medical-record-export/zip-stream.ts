import * as http from 'node:http';
import * as https from 'node:https';
import { Readable, Transform, TransformCallback } from 'node:stream';
import * as yazl from 'yazl';

export interface ZipEntry {
  name: string;
  /** Exact byte length; the archive's Content-Length is derived from these. */
  size: number;
  open: () => Promise<Readable>;
}

export interface StreamZipInput {
  entries: ZipEntry[];
  uploadUrl: string;
  contentType: string;
  /** Peak memory is roughly `maxConcurrentDownloads * entryBufferBytes`, whatever the archive's size. */
  maxConcurrentDownloads?: number;
  entryBufferBytes?: number;
  /** Fixing this makes an archive of the same inputs byte-identical. */
  mtime?: Date;
  /** Enforced by a timer, not between entries: a stalled transfer completes nothing to check against. */
  timeBudgetMs?: number;
  /** Awaited, so a caller that throws here (e.g. on its own budget) aborts the export. */
  onProgress?: (processed: number) => void | Promise<void>;
}

export interface StreamZipResult {
  bytesUploaded: number;
  entryCount: number;
}

// Kept small: an entry opened long before the writer reaches it sits on an idle socket, which object
// stores are entitled to hang up.
const DEFAULT_MAX_CONCURRENT_DOWNLOADS = 8;
const DEFAULT_ENTRY_BUFFER_BYTES = 4 * 1024 * 1024;

// S3 refuses a single PUT over 5 GiB and Z3 exposes no multipart upload.
export const MAX_SINGLE_PUT_BYTES = 5 * 1024 * 1024 * 1024;

/** `@types/yazl` types the final-size callback as taking no arguments; yazl passes the length, or -1. */
interface ZipFileWithFinalSize {
  end(options: yazl.EndOptions, finalSizeCallback: (totalSize: number) => void): void;
}

/**
 * Load-bearing, not a preference. yazl gates the 76-byte ZIP64 end record on
 * `centralDirectorySize >= 0xffff` when predicting the size but `>= 0xffffffff` when writing it, so above
 * ~900 entries it predicts 76 bytes more than it writes — a Content-Length the body never satisfies, and
 * an upload that hangs until the peer gives up. Forcing the record makes both paths agree at every size.
 */
const FORCE_ZIP64_EOCD: yazl.EndOptions = { forceZip64Format: true };

/** Seconds read better for a real budget of minutes, but must not round a sub-second one down to "0s". */
const formatBudget = (ms: number): string => (ms >= 1000 ? `${Math.round(ms / 1000)}s` : `${ms}ms`);

const endZipAndGetSize = (zip: yazl.ZipFile): number => {
  let finalSize = -1;
  (zip as unknown as ZipFileWithFinalSize).end(FORCE_ZIP64_EOCD, (totalSize) => {
    finalSize = totalSize;
  });
  return finalSize;
};

/** Asserts the entry's declared length. yazl checks this too, but without naming which entry failed. */
class SizeCheckedPassThrough extends Transform {
  private seen = 0;

  constructor(
    private readonly expected: number,
    private readonly label: string,
    highWaterMark: number
  ) {
    super({ highWaterMark });
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.seen += chunk.length;
    if (this.seen > this.expected) {
      callback(new Error(`Archive entry "${this.label}" is longer than its declared ${this.expected} bytes`));
      return;
    }
    callback(null, chunk);
  }

  override _flush(callback: TransformCallback): void {
    if (this.seen !== this.expected) {
      callback(new Error(`Archive entry "${this.label}" ended at ${this.seen} of its declared ${this.expected} bytes`));
      return;
    }
    callback();
  }
}

interface UploadHandle {
  done: Promise<void>;
  /** A PUT whose archive was abandoned part-way can never satisfy its Content-Length, so tear it down. */
  abort: (error: Error) => void;
}

const putStream = (input: {
  url: string;
  body: NodeJS.ReadableStream;
  contentLength: number;
  contentType: string;
}): UploadHandle => {
  let abort: (error: Error) => void = () => undefined;

  const done = new Promise<void>((resolve, reject) => {
    const target = new URL(input.url);
    const transport = target.protocol === 'http:' ? http : https;

    const request = transport.request(target, {
      method: 'PUT',
      // One upload per invocation, so pooling buys nothing and a retired pooled socket would fail it.
      agent: false,
      headers: {
        'Content-Type': input.contentType,
        'Content-Length': String(input.contentLength),
      },
    });

    request.on('response', (response) => {
      // Read only to surface the failure body, which S3 returns as XML.
      const chunks: string[] = [];
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => chunks.push(chunk));
      response.on('end', () => {
        const status = response.statusCode ?? 0;
        if (status >= 200 && status < 300) {
          resolve();
          return;
        }
        reject(new Error(`Archive upload failed [${status}]: ${chunks.join('').slice(0, 500)}`));
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    input.body.on('error', (error: Error) => {
      request.destroy(error);
      reject(error);
    });

    abort = (error: Error): void => {
      input.body.unpipe(request);
      request.destroy(error);
      reject(error);
    };

    input.body.pipe(request);
  });

  return { done, abort };
};

/**
 * The exact byte length the archive would have, without producing it. Works only because entries are
 * stored uncompressed with known sizes — yazl returns -1 otherwise — and is what lets the upload declare
 * a Content-Length before the first byte moves.
 */
export const predictZipSize = (entries: Pick<ZipEntry, 'name' | 'size'>[], mtime: Date = new Date()): number => {
  const zip = new yazl.ZipFile();
  // Abandoned mid-pump below; an unlistened error would be fatal.
  zip.on('error', () => undefined);

  const sinks = entries.map(() => new Transform({ transform: (chunk, _encoding, cb) => cb(null, chunk) }));
  entries.forEach((entry, i) => {
    zip.addReadStream(sinks[i], entry.name, { size: entry.size, compress: false, mtime });
  });

  const finalSize = endZipAndGetSize(zip);

  for (const sink of sinks) sink.destroy();

  return finalSize;
};

/**
 * Streams a zip of `entries` straight into a presigned PUT, so resident memory does not scale with the
 * archive.
 *
 * The length is committed in the request headers before any payload moves, so an entry that fails
 * mid-transfer fails the whole archive rather than being skipped. Resolve unreadable attachments first
 * (see `resolveAttachmentSizes`).
 */
export const streamZipToPresignedUrl = async ({
  entries,
  uploadUrl,
  contentType,
  maxConcurrentDownloads = DEFAULT_MAX_CONCURRENT_DOWNLOADS,
  entryBufferBytes = DEFAULT_ENTRY_BUFFER_BYTES,
  mtime = new Date(),
  timeBudgetMs,
  onProgress,
}: StreamZipInput): Promise<StreamZipResult> => {
  if (entries.length === 0) {
    throw new Error('streamZipToPresignedUrl called with no entries');
  }

  const zip = new yazl.ZipFile();

  // Sinks exist up front but request nothing until the pump reaches them; each one's highWaterMark is
  // what backpressures its download.
  const sinks = entries.map((entry) => new SizeCheckedPassThrough(entry.size, entry.name, entryBufferBytes));
  entries.forEach((entry, i) => {
    zip.addReadStream(sinks[i], entry.name, { size: entry.size, compress: false, mtime });
  });

  const openSources = new Set<Readable>();
  let failed = false;
  let abortUpload: (error: Error) => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const failure = new Promise<never>((_resolve, reject) => {
    fail = (error: Error): void => {
      if (failed) return;
      failed = true;
      for (const source of openSources) source.destroy();
      for (const sink of sinks) sink.destroy();
      abortUpload(error);
      reject(error);
    };
  });
  // Racing `failure` only handles its rejection until the race settles; keep it handled after.
  void failure.catch(() => undefined);

  zip.on('error', fail);
  for (const sink of sinks) sink.on('error', fail);

  const contentLength = endZipAndGetSize(zip);
  if (contentLength < 0) {
    throw new Error('Could not compute the archive length up front; every entry needs a known size and no compression');
  }
  if (contentLength > MAX_SINGLE_PUT_BYTES) {
    throw new Error(
      `Archive would be ${contentLength} bytes, over the ${MAX_SINGLE_PUT_BYTES}-byte single-upload limit`
    );
  }

  // Before the pump, so the archive drains as fast as it is produced.
  const upload = putStream({ url: uploadUrl, body: zip.outputStream, contentLength, contentType });
  abortUpload = upload.abort;
  // A dead upload must tear the pump down, or the workers go on filling sinks nobody is draining.
  void upload.done.catch((error) => fail(error instanceof Error ? error : new Error(String(error))));

  let processed = 0;
  let nextIndex = 0;

  const pumpEntry = async (index: number): Promise<void> => {
    const sink = sinks[index];
    const source = await entries[index].open();
    openSources.add(source);

    try {
      await new Promise<void>((resolve, reject) => {
        source.on('error', reject);
        sink.on('error', reject);
        // The readable side ending means yazl has taken every byte of this entry.
        sink.on('end', resolve);
        // `destroy()` with no error emits neither `end` nor `error`, so without this the in-flight
        // entry's promise would never settle when the abort path tears the sinks down.
        sink.on('close', () =>
          reject(new Error(`Archive entry "${entries[index].name}" was torn down before it finished`))
        );
        source.pipe(sink);
      });
    } finally {
      openSources.delete(source);
    }
  };

  // Workers claim entries in order and yazl consumes them in order, so a worker holding a later entry
  // blocks on its sink until the writer arrives — making the open downloads a sliding window.
  const worker = async (): Promise<void> => {
    for (;;) {
      if (failed) return;
      const index = nextIndex++;
      if (index >= entries.length) return;
      try {
        await pumpEntry(index);
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      processed += 1;
      try {
        await onProgress?.(processed);
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
        return;
      }
    }
  };

  const budgetTimer =
    timeBudgetMs === undefined
      ? undefined
      : setTimeout(
          () =>
            fail(
              new Error(
                `Archive streaming exceeded its ${formatBudget(timeBudgetMs)} budget after ` +
                  `${processed}/${entries.length} entries`
              )
            ),
          Math.max(0, timeBudgetMs)
        );
  // Must never be the reason the process stays alive once the export has settled.
  budgetTimer?.unref();

  try {
    const poolSize = Math.min(maxConcurrentDownloads, entries.length);
    await Promise.race([Promise.all(Array.from({ length: poolSize }, () => worker())), failure]);
    await Promise.race([upload.done, failure]);
  } finally {
    if (budgetTimer) clearTimeout(budgetTimer);
  }

  return { bytesUploaded: contentLength, entryCount: entries.length };
};
