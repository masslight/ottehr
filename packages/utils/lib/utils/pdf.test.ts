import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import { fitWrappedTextToBanner } from './pdf';

let helveticaBold: PDFFont;

beforeAll(async () => {
  const doc = await PDFDocument.create();
  helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
});

const baseOptions = {
  maxWidth: 500,
  initialFontSize: 24,
  minFontSize: 18,
  lineHeightRatio: 1.3,
  bannerHeight: 80,
  verticalPadding: 10,
  maxLines: 3,
};

describe('fitWrappedTextToBanner', () => {
  it('uses initialFontSize when the title fits on one line at full size', () => {
    const result = fitWrappedTextToBanner({ ...baseOptions, text: 'Short title', font: helveticaBold });

    expect(result.fontSize).toBe(24);
    expect(result.lines).toEqual(['Short title']);
    expect(result.lineHeight).toBeCloseTo(24 * 1.3);
  });

  it('shrinks the font when the title would otherwise overflow', () => {
    const longTitle =
      'Understanding Mpox Symptoms Care and Prevention for Patients Recovering at Home with Their Families';
    const result = fitWrappedTextToBanner({ ...baseOptions, text: longTitle, font: helveticaBold });

    expect(result.fontSize).toBeLessThan(24);
    expect(result.fontSize).toBeGreaterThanOrEqual(18);
    expect(result.lines.length).toBeLessThanOrEqual(3);
  });

  it('falls back to ellipsis at minFontSize when the title cannot fit even shrunk', () => {
    // Crafted so even at minFontSize / maxLines it overflows.
    const veryLongTitle = Array.from({ length: 40 }, () => 'OverflowWord').join(' ');
    const result = fitWrappedTextToBanner({ ...baseOptions, text: veryLongTitle, font: helveticaBold });

    expect(result.fontSize).toBe(18);
    expect(result.lines.length).toBe(3);
    expect(result.lines[2]).toMatch(/\.\.\.$/);
  });

  it('returns a non-empty lines array for an empty title', () => {
    const result = fitWrappedTextToBanner({ ...baseOptions, text: '', font: helveticaBold });

    expect(result.lines).toEqual(['']);
    expect(result.fontSize).toBe(24);
  });

  it('wraps multi-word titles across multiple lines without losing words', () => {
    const title = 'Acute Otitis Media with Effusion in Both Ears';
    const result = fitWrappedTextToBanner({ ...baseOptions, text: title, font: helveticaBold });

    expect(result.lines.join(' ').replace(/\s+/g, ' ').trim()).toBe(title);
  });

  it('reports blockHeight = ascender + (lineCount - 1) * lineHeight', () => {
    const title = 'Acute Otitis Media with Effusion in Both Ears';
    const result = fitWrappedTextToBanner({ ...baseOptions, text: title, font: helveticaBold });

    const expected = result.ascender + (result.lines.length - 1) * result.lineHeight;
    expect(result.blockHeight).toBeCloseTo(expected);
  });

  it('keeps the fitted block within the banner padding when it can fit', () => {
    const title = 'Acute Otitis Media';
    const result = fitWrappedTextToBanner({ ...baseOptions, text: title, font: helveticaBold });

    expect(result.blockHeight).toBeLessThanOrEqual(baseOptions.bannerHeight - baseOptions.verticalPadding * 2);
  });

  it('respects maxLines when shrinking is enough', () => {
    const title = 'Understanding Mpox Symptoms Care and Prevention';
    const result = fitWrappedTextToBanner({ ...baseOptions, text: title, font: helveticaBold, maxLines: 2 });

    expect(result.lines.length).toBeLessThanOrEqual(2);
  });
});
