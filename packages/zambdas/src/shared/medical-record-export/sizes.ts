import { mapWithConcurrency } from '../concurrency';
import { NamedAttachment } from './naming';

export interface SizedAttachment {
  name: string;
  size: number;
  url: string;
}

export interface SkippedAttachment {
  name: string;
  url: string;
  reason: string;
}

export interface ResolveSizesResult {
  entries: SizedAttachment[];
  skipped: SkippedAttachment[];
  totalBytes: number;
}

export interface ResolveSizesInput {
  attachments: NamedAttachment[];
  presign: (url: string) => Promise<string>;
  concurrency: number;
}

const parseTotalFromContentRange = (contentRange: string | null): number | undefined => {
  const total = contentRange?.split('/')[1]?.trim();
  if (!total) return undefined;
  const parsed = Number(total);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

const resolveOneSize = async (
  attachment: NamedAttachment,
  presign: (url: string) => Promise<string>
): Promise<SizedAttachment | SkippedAttachment> => {
  const skip = (reason: string): SkippedAttachment => ({ name: attachment.name, url: attachment.url, reason });

  let downloadUrl: string;
  try {
    downloadUrl = await presign(attachment.url);
  } catch (error) {
    return skip(`could not presign: ${String(error)}`);
  }

  try {
    const response = await fetch(downloadUrl, {
      headers: { Range: 'bytes=0-0', 'Cache-Control': 'no-cache' },
    });

    if (response.status === 416) {
      return { name: attachment.name, size: 0, url: attachment.url };
    }

    if (!response.ok) {
      return skip(`size probe failed [${response.status}]`);
    }

    let size: number | undefined;
    if (response.status === 206) {
      size = parseTotalFromContentRange(response.headers.get('content-range'));
      await response.arrayBuffer().catch(() => undefined);
    } else {
      size = (await response.arrayBuffer()).byteLength;
    }

    if (size === undefined || !Number.isSafeInteger(size) || size < 0) {
      return skip('size probe returned no usable length');
    }

    if (attachment.size !== undefined && attachment.size !== size) {
      console.warn(
        `Attachment ${attachment.url} records size ${attachment.size} but the object is ${size} bytes; using ${size}`
      );
    }

    return { name: attachment.name, size, url: attachment.url };
  } catch (error) {
    return skip(`size probe threw: ${String(error)}`);
  }
};

const isSkipped = (result: SizedAttachment | SkippedAttachment): result is SkippedAttachment => 'reason' in result;

export const resolveAttachmentSizes = async ({
  attachments,
  presign,
  concurrency,
}: ResolveSizesInput): Promise<ResolveSizesResult> => {
  const results = await mapWithConcurrency(attachments, concurrency, (attachment) =>
    resolveOneSize(attachment, presign)
  );

  const entries: SizedAttachment[] = [];
  const skipped: SkippedAttachment[] = [];
  let totalBytes = 0;
  for (const result of results) {
    if (isSkipped(result)) {
      console.error(`Skipping attachment ${result.url}: ${result.reason}`);
      skipped.push(result);
    } else {
      entries.push(result);
      totalBytes += result.size;
    }
  }

  return { entries, skipped, totalBytes };
};
