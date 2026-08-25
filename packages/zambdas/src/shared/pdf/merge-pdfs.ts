import { Jimp, JimpMime } from 'jimp';
import { PageSizes, PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib';
import { MIME_TYPES } from 'utils/lib/utils/file';
import { getImageOrientation } from 'utils/lib/utils/image-orientation';
import { createPresignedUrl } from '../z3Utils';

// Match the existing fax cover renderer so image-backed packets do not mix A4 and Letter pages.
const [PAGE_WIDTH, PAGE_HEIGHT] = PageSizes.A4;
const IMAGE_MARGIN = 24;
const FAX_JPEG_QUALITY = 85;
const PLACEHOLDER_MARGIN = 48;
const PLACEHOLDER_TITLE_MAX_LENGTH = 160;

/**
 * Downloads a file stored at the given z3 url, presigning it for download first.
 * Throws a descriptive error if the download fails.
 */
export async function downloadFileBytes(z3Url: string, token: string): Promise<Uint8Array> {
  const presignedUrl = await createPresignedUrl(token, z3Url, 'download');
  const response = await fetch(presignedUrl);

  if (!response.ok) {
    throw new Error(`Failed to download file from ${z3Url}: ${response.status} ${response.statusText}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Converts a supported image to a one-page PDF, or returns PDF bytes unchanged. Fax transport accepts one
 * PDF, while patient documents may be stored as PNG or JPEG attachments. The bytes are authoritative and
 * the declared type is used only for diagnostics, so a mislabeled file fails closed instead of producing an
 * incomplete packet.
 */
export async function normalizeFileToPdf(bytes: Uint8Array, contentType?: string): Promise<Uint8Array> {
  const detectedType = detectFileType(bytes);
  if (detectedType === MIME_TYPES.PDF) return bytes;

  const pdf = await PDFDocument.create();
  const jpegBytes =
    detectedType === MIME_TYPES.JPEG || detectedType === MIME_TYPES.JPG ? await normalizeJpegOrientation(bytes) : bytes;
  const image =
    detectedType === MIME_TYPES.PNG
      ? await pdf.embedPng(bytes)
      : detectedType === MIME_TYPES.JPEG || detectedType === MIME_TYPES.JPG
      ? await pdf.embedJpg(jpegBytes)
      : undefined;
  if (!image) throw new Error(`Unsupported fax attachment type: ${contentType || 'unknown'}`);

  const landscape = image.width > image.height;
  const pageWidth = landscape ? PAGE_HEIGHT : PAGE_WIDTH;
  const pageHeight = landscape ? PAGE_WIDTH : PAGE_HEIGHT;
  const scale = Math.min((pageWidth - IMAGE_MARGIN * 2) / image.width, (pageHeight - IMAGE_MARGIN * 2) / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const page = pdf.addPage([pageWidth, pageHeight]);
  page.drawImage(image, {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  });
  return pdf.save();
}

/**
 * Creates an explicit replacement page for an attachment that was present in the patient record but
 * could not be converted to a fax-compatible page. This lets the fax continue without silently
 * omitting content.
 */
export async function createFaxAttachmentPlaceholderPdf(documentTitle: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [pageWidth, pageHeight] = PageSizes.A4;
  const page = pdf.addPage([pageWidth, pageHeight]);
  const contentWidth = pageWidth - PLACEHOLDER_MARGIN * 2;

  let y = pageHeight - PLACEHOLDER_MARGIN;
  page.drawText('Attachment could not be rendered', {
    x: PLACEHOLDER_MARGIN,
    y,
    size: 18,
    font: bold,
    color: rgb(0.08, 0.2, 0.45),
  });

  y -= 42;
  const printableTitle = toPrintablePdfText(documentTitle);
  for (const line of wrapPdfText(`Document: ${printableTitle}`, bold, 12, contentWidth)) {
    page.drawText(line, { x: PLACEHOLDER_MARGIN, y, size: 12, font: bold });
    y -= 18;
  }

  y -= 14;
  const notice =
    'This document was present in the patient record but could not be converted into a fax-compatible page. ' +
    'It was not included in this transmission. Please contact the sender if you need a copy.';
  for (const line of wrapPdfText(notice, regular, 11, contentWidth)) {
    page.drawText(line, { x: PLACEHOLDER_MARGIN, y, size: 11, font: regular, color: rgb(0.2, 0.2, 0.2) });
    y -= 17;
  }

  return pdf.save();
}

/** Standard PDF fonts only support WinAnsi; retain a readable, bounded identifier without risking another render error. */
const toPrintablePdfText = (value: string): string => {
  const ascii = value.replace(/[^\x20-\x7e]/g, '?').trim() || 'Untitled document';
  return ascii.length > PLACEHOLDER_TITLE_MAX_LENGTH ? `${ascii.slice(0, PLACEHOLDER_TITLE_MAX_LENGTH - 3)}...` : ascii;
};

/** Prefer whole words, while still breaking long filenames that have no spaces. */
const wrapPdfText = (value: string, font: PDFFont, fontSize: number, maxWidth: number): string[] => {
  const lines: string[] = [];
  let line = '';

  for (const word of value.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) {
      lines.push(line);
      line = '';
    }

    for (const character of word) {
      const chunk = line + character;
      if (line && font.widthOfTextAtSize(chunk, fontSize) > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = chunk;
      }
    }
  }

  if (line) lines.push(line);
  return lines;
};

/** Jimp applies EXIF orientation while decoding. Only tagged JPEGs are re-encoded, avoiding needless
 * quality loss and CPU work for the common already-upright path. */
const normalizeJpegOrientation = async (bytes: Uint8Array): Promise<Uint8Array> => {
  try {
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const orientation = getImageOrientation(arrayBuffer);
    if (orientation < 2 || orientation > 8) return bytes;

    const image = await Jimp.read(Buffer.from(bytes));
    // cast: jimp's Buffer type resolves against a second @types/node copy in this workspace
    const encoded = (await image.getBuffer(JimpMime.jpeg, { quality: FAX_JPEG_QUALITY })) as unknown as Uint8Array;
    return Uint8Array.from(encoded);
  } catch {
    // EXIF correction is best-effort. Let pdf-lib validate and embed the original JPEG so malformed
    // metadata or a Jimp decoding failure cannot reject an otherwise faxable image.
    return bytes;
  }
};

const detectFileType = (bytes: Uint8Array): string | undefined => {
  // The PDF header may legally appear after a short binary preamble, but must be within the first 1024 bytes.
  const pdfHeaderEnd = Math.min(bytes.length - 3, 1024);
  for (let index = 0; index < pdfHeaderEnd; index++) {
    if (bytes[index] === 0x25 && bytes[index + 1] === 0x50 && bytes[index + 2] === 0x44 && bytes[index + 3] === 0x46) {
      return MIME_TYPES.PDF;
    }
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return MIME_TYPES.PNG;
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return MIME_TYPES.JPEG;
  }
  return undefined;
};

/**
 * Merges the given PDFs into a single document, in order. The first part is used as the base
 * document and the pages of every subsequent part are appended to it.
 */
export async function mergePdfDocuments(parts: Uint8Array[]): Promise<{ bytes: Uint8Array; pageCount: number }> {
  if (parts.length === 0) {
    throw new Error('Cannot merge PDFs: no documents provided');
  }

  const mergedPdf = await PDFDocument.load(parts[0]);

  for (const part of parts.slice(1)) {
    const pdf = await PDFDocument.load(part);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
  }

  return { bytes: await mergedPdf.save(), pageCount: mergedPdf.getPageCount() };
}

/**
 * Returns the number of pages in the given PDF.
 */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPageCount();
}
