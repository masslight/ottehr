import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

export const DOWNLOAD_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;

export interface OpenAttachmentInput {
  /** Z3 url; signed per attempt, since a signature can expire mid-export. */
  url: string;
  name: string;
  presign: (url: string) => Promise<string>;
  attempts?: number;
  retryDelayMs?: (attempt: number) => number;
}

/**
 * Opens one document's bytes, retrying a failure to *start* the transfer.
 *
 * Only the start is retryable: nothing is written to the archive until the returned stream is piped, so a
 * failed presign or connect can be retried with the writer none the wiser. Once bytes have flowed the
 * entry is partly in the zip and its length is already committed, so a mid-transfer failure must fail the
 * whole export instead.
 */
export const openAttachmentStream = async ({
  url,
  name,
  presign,
  attempts = DOWNLOAD_ATTEMPTS,
  retryDelayMs = (attempt) => RETRY_BASE_DELAY_MS * attempt,
}: OpenAttachmentInput): Promise<Readable> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const downloadUrl = await presign(url);
      const response = await fetch(downloadUrl, { headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok || !response.body) {
        throw new Error(`Download failed [${response.status}] for archive entry "${name}"`);
      }
      return Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.warn(`Attempt ${attempt}/${attempts} to open archive entry "${name}" failed: ${String(error)}`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt)));
      }
    }
  }

  console.error(`Giving up on archive entry "${name}" after ${attempts} attempts`);
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};
