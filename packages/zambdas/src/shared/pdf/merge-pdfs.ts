import { PDFDocument } from 'pdf-lib';
import { createPresignedUrl } from '../z3Utils';

/**
 * Downloads the PDF stored at the given z3 url, presigning it for download first.
 * Throws a descriptive error if the download fails.
 */
export async function downloadPdfBytes(z3Url: string, token: string): Promise<Uint8Array> {
  const presignedUrl = await createPresignedUrl(token, z3Url, 'download');
  const response = await fetch(presignedUrl);

  if (!response.ok) {
    throw new Error(`Failed to download PDF from ${z3Url}: ${response.status} ${response.statusText}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

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
