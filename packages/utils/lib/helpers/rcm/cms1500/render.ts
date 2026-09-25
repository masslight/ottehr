import { PDFDocument, PDFFont, PDFPage, PrintScaling, rgb, StandardFonts } from 'pdf-lib';
import { Cms1500FormData } from '../../../types/data/billing/cms1500.types';
import { CMS1500_BOXES, CMS1500_PAGE } from './layout';
import { Cms1500PageValues, cms1500PageValues } from './values';

export interface Cms1500RenderOptions {
  // Shifts the data to line up with a particular printer, in points (1/72"). Positive values move it
  // right and down.
  offset?: { x: number; y: number };
  // The date next to the signature on file in item 31 (YYYY-MM-DD); today if not given.
  signedOn?: string;
}

// Pica type is 12 pt Courier: 7.2 pt per character is exactly 10 characters per inch.
const DATA_FONT_SIZE = 12;
// Baseline height above the bottom of a print line, which centers capitals on the line.
const BASELINE_RISE = 2.5;

// Renders each claim as one or more pages of just the data, to print onto pre-printed red CMS-1500
// forms.
export async function renderCms1500Pdf(
  forms: Cms1500FormData[],
  options: Cms1500RenderOptions = {}
): Promise<Uint8Array> {
  const { offset = { x: 0, y: 0 }, signedOn } = options;
  const doc = await PDFDocument.create();
  doc.setTitle('CMS-1500 Health Insurance Claim Form');
  // Pre-printed forms only line up when the PDF prints at actual size.
  doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const font = await doc.embedFont(StandardFonts.Courier);

  for (const form of forms) {
    for (const values of cms1500PageValues(form, signedOn)) {
      drawValues(doc.addPage([CMS1500_PAGE.width, CMS1500_PAGE.height]), values, font, offset);
    }
  }
  return doc.save();
}

function drawValues(page: PDFPage, values: Cms1500PageValues, font: PDFFont, offset: { x: number; y: number }): void {
  const draw = (text: string, line: number, col: number): void =>
    page.drawText(text, {
      x: (col - 1) * CMS1500_PAGE.columnWidth + offset.x,
      y: CMS1500_PAGE.height - line * CMS1500_PAGE.lineHeight + BASELINE_RISE - offset.y,
      size: DATA_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });

  for (const { name, box } of CMS1500_BOXES) {
    const value = values[name];
    if (!value) continue;
    if ('cols' in box) {
      const col = box.cols[value];
      if (col) draw('X', box.line, col);
    } else if (box.align === 'right') {
      // Amounts are never cut off; a value wider than the box runs into the space to its left.
      draw(value, box.line, box.col + box.width - value.length);
    } else {
      draw(value.slice(0, box.width), box.line, box.col);
    }
  }
}
