import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import { beforeAll, describe, expect, test } from 'vitest';
import { splitLongStringToPageSize } from '../../src/shared/pdf/pdf-utils';

const FONT_SIZE = 10;
const WIDTH = 80;
const CLAIM_ID = '5a41e0e9-2eff-4fa0-9746-35c272d4415b';

describe('splitLongStringToPageSize', () => {
  let font: PDFFont;

  beforeAll(async () => {
    const pdfDoc = await PDFDocument.create();
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  });

  test('wraps words at spaces', () => {
    expect(splitLongStringToPageSize('Test Omar Urgent Care', font, FONT_SIZE, WIDTH)).toEqual([
      'Test Omar ',
      'Urgent Care ',
    ]);
  });

  test('breaks a word wider than the width into pieces that fit, starting on the first line', () => {
    const lines = splitLongStringToPageSize(CLAIM_ID, font, FONT_SIZE, WIDTH);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0]).not.toBe('');
    expect(lines.map((line) => line.trim()).join('')).toBe(CLAIM_ID);
    lines.forEach((line) => expect(font.widthOfTextAtSize(line, FONT_SIZE)).toBeLessThanOrEqual(WIDTH));
  });

  test('moves an overlong word after other words to its own lines', () => {
    const lines = splitLongStringToPageSize(`ID ${CLAIM_ID}`, font, FONT_SIZE, WIDTH);

    expect(lines[0]).toBe('ID ');
    expect(
      lines
        .slice(1)
        .map((line) => line.trim())
        .join('')
    ).toBe(CLAIM_ID);
  });
});
