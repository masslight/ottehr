import { Jimp, JimpMime } from 'jimp';
import { PageSizes, PDFDocument } from 'pdf-lib';
import { describe, expect, test } from 'vitest';
import { countPdfPages, mergePdfDocuments, normalizeFileToPdf } from '../../src/shared/pdf/merge-pdfs';

const makePdf = async (pageCount: number): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdf.addPage();
  }
  return pdf.save();
};

describe('mergePdfDocuments', () => {
  test('merging two PDFs yields the sum of their pages', async () => {
    const [first, second] = await Promise.all([makePdf(2), makePdf(3)]);

    const { bytes, pageCount } = await mergePdfDocuments([first, second]);

    expect(pageCount).toBe(5);
    expect(await countPdfPages(bytes)).toBe(5);
  });

  test('a single part is returned with its own page count', async () => {
    const only = await makePdf(4);

    const { bytes, pageCount } = await mergePdfDocuments([only]);

    expect(pageCount).toBe(4);
    expect(await countPdfPages(bytes)).toBe(4);
  });

  test('throws when no parts are provided', async () => {
    await expect(mergePdfDocuments([])).rejects.toThrow(/no documents provided/);
  });
});

describe('countPdfPages', () => {
  test('returns the page count of a PDF', async () => {
    expect(await countPdfPages(await makePdf(1))).toBe(1);
    expect(await countPdfPages(await makePdf(7))).toBe(7);
  });
});

describe('normalizeFileToPdf', () => {
  test('returns existing PDF bytes without rebuilding them', async () => {
    const bytes = await makePdf(2);

    await expect(normalizeFileToPdf(bytes, 'application/pdf')).resolves.toBe(bytes);
  });

  test('renders a PNG attachment onto one PDF page', async () => {
    const png = Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64'
      )
    );

    const pdf = await normalizeFileToPdf(png, 'image/png');

    expect(await countPdfPages(pdf)).toBe(1);
  });

  test('renders a JPEG attachment onto one landscape PDF page', async () => {
    const image = new Jimp({ width: 2, height: 1, color: 0xffffffff });
    const jpeg = Uint8Array.from(await image.getBuffer(JimpMime.jpeg));

    const bytes = await normalizeFileToPdf(jpeg, 'image/jpeg');
    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(PageSizes.A4[1]);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(PageSizes.A4[0]);
  });

  test('rejects an unsupported attachment instead of passing invalid bytes to the PDF merger', async () => {
    await expect(normalizeFileToPdf(new Uint8Array([1, 2, 3]), 'text/plain')).rejects.toThrow(
      'Unsupported fax attachment type: text/plain'
    );
  });

  test('trusts file bytes over a misleading PDF content type', async () => {
    const unsupportedBytes = new Uint8Array([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);

    await expect(normalizeFileToPdf(unsupportedBytes, 'application/pdf')).rejects.toThrow(
      'Unsupported fax attachment type: application/pdf'
    );
  });
});
