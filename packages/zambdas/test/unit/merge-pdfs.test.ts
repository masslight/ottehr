import { PDFDocument } from 'pdf-lib';
import { describe, expect, test } from 'vitest';
import { countPdfPages, mergePdfDocuments } from '../../src/shared/pdf/merge-pdfs';

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
