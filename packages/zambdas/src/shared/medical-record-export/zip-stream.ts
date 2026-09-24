import * as http from 'node:http';
import * as https from 'node:https';
import { Readable, Transform, TransformCallback } from 'node:stream';
import * as yazl from 'yazl';

export interface ZipEntry {
  name: string;
  size: number;
  open: () => Promise<Readable>;
}

export interface StreamZipInput {
  entries: ZipEntry[];
  uploadUrl: string;
  contentType: string;
  maxConcurrentDownloads?: number;
  entryBufferBytes?: number;
  mtime?: Date;
  timeBudgetMs?: number;
  onProgress?: (processed: number) => void | Promise<void>;
}

export interface StreamZipResult {
  bytesUploaded: number;
  entryCount: number;
}

const DEFAULT_MAX_CONCURRENT_DOWNLOADS = 8;
const DEFAULT_ENTRY_BUFFER_BYTES = 4 * 1024 * 1024;

export const MAX_SINGLE_PUT_BYTES = 5 * 1024 * 1024 * 1024;

interface ZipFileWithFinalSize {
  end(options: yazl.EndOptions, finalSizeCallback: (totalSize: number) => void): void;
}

const FORCE_ZIP64_EOCD: yazl.EndOptions = { forceZip64Format: true };

const formatBudget = (ms: number): string => (ms >= 1000 ? `${Math.round(ms / 1000)}s` : `${ms}ms`);

const endZipAndGetSize = (zip: yazl.ZipFile): number => {
  let finalSize = -1;
  (zip as unknown as ZipFileWithFinalSize).end(FORCE_ZIP64_EOCD, (totalSize) => {
    finalSize = totalSize;
  });
  return finalSize;
};

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
      agent: false,
      headers: {
        'Content-Type': input.contentType,
        'Content-Length': String(input.contentLength),
      },
    });

    request.on('response', (response) => {
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

export const predictZipSize = (entries: Pick<ZipEntry, 'name' | 'size'>[], mtime: Date = new Date()): number => {
  const zip = new yazl.ZipFile();
  zip.on('error', () => undefined);

  const sinks = entries.map(() => new Transform({ transform: (chunk, _encoding, cb) => cb(null, chunk) }));
  entries.forEach((entry, i) => {
    zip.addReadStream(sinks[i], entry.name, { size: entry.size, compress: false, mtime });
  });

  const finalSize = endZipAndGetSize(zip);

  for (const sink of sinks) sink.destroy();

  return finalSize;
};

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

  const upload = putStream({ url: uploadUrl, body: zip.outputStream, contentLength, contentType });
  abortUpload = upload.abort;
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
        sink.on('end', resolve);
        sink.on('close', () =>
          reject(new Error(`Archive entry "${entries[index].name}" was torn down before it finished`))
        );
        source.pipe(sink);
      });
    } finally {
      openSources.delete(source);
    }
  };

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
