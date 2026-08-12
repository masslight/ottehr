import { PageSizes, PDFDocument, PDFImage } from 'pdf-lib';
import { FaxRecipient } from 'utils/lib/types/api/fax.types';
import { FAX_TOO_LARGE_ERROR } from 'utils/lib/types/errors';
import { getMimeType, isFaxableAttachment, MIME_TYPES } from 'utils/lib/utils/file';
import { createPresignedUrl } from '../z3Utils';
import { drawFaxCoverPage, FaxCoverAssets, FaxCoverPageInfo, FaxSender } from './fax-cover-page';

// OOM guard: every downloaded document is held in memory while the packet is assembled, and the
// composed PDF is buffered in full for the Z3 upload. Cap the payload at a fraction of the
// function's memory after headroom so we fail with a clear error instead of crashing.
const FUNCTION_MEMORY_MB = Number(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE) || 1024;
const MEMORY_HEADROOM_MB = 256;
const MAX_FAX_BYTES = Math.max(32, Math.floor((FUNCTION_MEMORY_MB - MEMORY_HEADROOM_MB) / 3)) * 1024 * 1024;

export interface FaxAttachment {
  url: string;
  contentType?: string;
  title?: string;
}

/**
 * The documents of one transmission, downloaded and turned into pages. Held as a loaded
 * PDFDocument so the same bytes can be copied into a packet per recipient without re-downloading.
 */
export interface FaxContent {
  document: PDFDocument;
  pageCount: number;
}

interface RenderFaxContentOptions {
  /** Injectable for tests; production uses the Lambda-derived memory budget above. */
  maxBytes?: number;
}

/**
 * Downloads the attachments and renders the faxable ones into pages, in order. Formats a fax
 * machine cannot render (such as a zip) are intentionally excluded. A selected PDF/image that
 * cannot be downloaded or rendered fails the transmission so we never send a silently incomplete
 * medical record.
 */
export const renderFaxContent = async (
  attachments: FaxAttachment[],
  m2mToken: string,
  options: RenderFaxContentOptions = {}
): Promise<FaxContent> => {
  const document = await PDFDocument.create();
  let totalBytes = 0;
  const maxBytes = options.maxBytes ?? MAX_FAX_BYTES;

  // Sequential on purpose: documents must keep their order and share one byte budget.
  for (const attachment of attachments) {
    const bytes = await downloadAttachment(attachment, m2mToken, maxBytes - totalBytes, maxBytes);
    if (!bytes) continue;
    totalBytes += bytes.length;
    await appendAttachment(document, attachment, bytes);
  }

  return { document, pageCount: document.getPageCount() };
};

/** Builds the PDF for one recipient: the cover sheet followed by the rendered documents. */
export const assembleFaxPacket = async (
  content: FaxContent,
  cover: Pick<FaxCoverPageInfo, 'title' | 'identifiers'>,
  context: { recipient: FaxRecipient; sender: FaxSender; generatedAt: string },
  assets: FaxCoverAssets
): Promise<Uint8Array> => {
  const packet = await PDFDocument.create();
  await drawFaxCoverPage(packet, { ...cover, ...context, pageCount: content.pageCount + 1 }, assets);
  const pages = await packet.copyPages(content.document, content.document.getPageIndices());
  pages.forEach((page) => packet.addPage(page));
  return packet.save();
};

const downloadAttachment = async (
  attachment: FaxAttachment,
  m2mToken: string,
  remainingBytes: number,
  maxBytes: number
): Promise<Uint8Array | undefined> => {
  if (!isFaxableAttachment(attachment)) {
    console.log(`Skipping ${attachment.url}: ${resolveMimeType(attachment) ?? 'unknown type'} cannot be faxed`);
    return undefined;
  }

  const downloadUrl = await createPresignedUrl(m2mToken, attachment.url, 'download');
  const response = await fetch(downloadUrl, { headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) {
    throw new Error(`Could not download fax attachment [${response.status}] for ${attachment.url}`);
  }
  return readResponseWithLimit(response, remainingBytes, maxBytes);
};

const readResponseWithLimit = async (
  response: Response,
  remainingBytes: number,
  maxBytes: number
): Promise<Uint8Array> => {
  const declaredLength = Number(response.headers?.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > remainingBytes) throwFaxTooLarge(maxBytes);

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > remainingBytes) throwFaxTooLarge(maxBytes);
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let readResult = await reader.read();
  while (!readResult.done) {
    const { value } = readResult;
    total += value.length;
    if (total > remainingBytes) {
      await reader.cancel();
      throwFaxTooLarge(maxBytes);
    }
    chunks.push(value);
    readResult = await reader.read();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.length;
  });
  return bytes;
};

const throwFaxTooLarge = (maxBytes: number): never => {
  throw FAX_TOO_LARGE_ERROR(Math.max(1, Math.floor(maxBytes / (1024 * 1024))));
};

const appendAttachment = async (document: PDFDocument, attachment: FaxAttachment, bytes: Uint8Array): Promise<void> => {
  const mimeType = resolveMimeType(attachment);
  if (mimeType === MIME_TYPES.PDF) {
    const source = await PDFDocument.load(bytes);
    const pages = await document.copyPages(source, source.getPageIndices());
    pages.forEach((page) => document.addPage(page));
    return;
  }
  const image = mimeType === MIME_TYPES.PNG ? await document.embedPng(bytes) : await document.embedJpg(bytes);
  drawImagePage(document, image);
};

const drawImagePage = (document: PDFDocument, image: PDFImage): void => {
  const [pageWidth, pageHeight] = PageSizes.A4;
  const margin = 25;
  const scale = Math.min((pageWidth - margin * 2) / image.width, (pageHeight - margin * 2) / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  const page = document.addPage(PageSizes.A4);
  page.drawImage(image, { x: (pageWidth - width) / 2, y: pageHeight - margin - height, width, height });
};

/** DocumentReference attachments don't always carry a contentType; fall back to the file extension. */
const resolveMimeType = (attachment: FaxAttachment): string | undefined =>
  attachment.contentType ?? getMimeType(attachment.url);
