import { Jimp, JimpMime } from 'jimp';
import { PageSizes, PDFDocument } from 'pdf-lib';
import { getImageOrientation } from 'utils/lib/utils/image-orientation';
import { describe, expect, test, vi } from 'vitest';
import { makeOrientedSceneJpeg } from '../../src/ehr/extract-insurance-card/test/image-fixtures';
import {
  countPdfPages,
  createFaxAttachmentPlaceholderPdf,
  mergePdfDocuments,
  normalizeFileToPdf,
} from '../../src/shared/pdf/merge-pdfs';

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

describe('createFaxAttachmentPlaceholderPdf', () => {
  test('creates one readable notice page even for a long title outside the standard font character set', async () => {
    const bytes = await createFaxAttachmentPlaceholderPdf(`患者-${'scan'.repeat(100)}.jpg`);

    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
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

  test.each([6, 8] as const)('applies EXIF orientation %s before choosing the PDF page layout', async (orientation) => {
    // The displayed scene is landscape, while the stored pixels are portrait for orientations 6/8.
    const jpeg = Uint8Array.from(await makeOrientedSceneJpeg(orientation, 32, 16));

    const bytes = await normalizeFileToPdf(jpeg, 'image/jpeg');
    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(PageSizes.A4[1]);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(PageSizes.A4[0]);
  });

  test('falls back to the original JPEG when its EXIF metadata is malformed', async () => {
    const image = new Jimp({ width: 2, height: 1, color: 0xffffffff });
    const jpeg = Buffer.from((await image.getBuffer(JimpMime.jpeg)) as unknown as Uint8Array);
    const malformedExif = Buffer.from([
      0xff,
      0xe1, // APP1 marker
      0x00,
      0x14, // segment length
      0x45,
      0x78,
      0x69,
      0x66,
      0x00,
      0x00, // "Exif\0\0"
      0x49,
      0x49,
      0x2a,
      0x00, // little-endian TIFF header
      0xff,
      0xff,
      0xff,
      0x7f, // invalid IFD offset outside the file
      0x00,
      0x00,
      0x00,
      0x00,
    ]);
    const bytes = Uint8Array.from(
      Buffer.concat([jpeg.subarray(0, 2), malformedExif, jpeg.subarray(2)] as unknown as Uint8Array[])
    );
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    expect(() => getImageOrientation(arrayBuffer)).toThrow(RangeError);

    const pdf = await normalizeFileToPdf(bytes, 'image/jpeg');

    expect(await countPdfPages(pdf)).toBe(1);
  });

  test('falls back to the original JPEG when Jimp cannot apply its EXIF orientation', async () => {
    const jpeg = Uint8Array.from(await makeOrientedSceneJpeg(6, 32, 16));
    vi.spyOn(Jimp, 'read').mockRejectedValueOnce(new Error('Unable to decode JPEG'));

    const pdf = await normalizeFileToPdf(jpeg, 'image/jpeg');

    expect(await countPdfPages(pdf)).toBe(1);
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
