import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

export const DOWNLOAD_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;

export interface OpenAttachmentInput {
  url: string;
  name: string;
  presign: (url: string) => Promise<string>;
  attempts?: number;
  retryDelayMs?: (attempt: number) => number;
}

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
