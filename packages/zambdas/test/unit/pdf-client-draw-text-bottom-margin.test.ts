import * as fs from 'fs';
import { join } from 'path';
import { PDFPage } from 'pdf-lib';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PDF_CLIENT_STYLES } from '../../src/shared/pdf/pdf-consts';
import { createPdfClient } from '../../src/shared/pdf/pdf-utils';
import { TextStyle } from '../../src/shared/pdf/types';

describe('pdf client drawText — wrapped lines near the bottom margin', () => {
  const BOTTOM_MARGIN = PDF_CLIENT_STYLES.initialPage.pageMargins.bottom ?? 0;
  const LONG_TEXT = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('never draws a line lower than the room the first line is given, whatever Y the text starts at', async () => {
    const client = await createPdfClient(PDF_CLIENT_STYLES);
    const font = await client.embedFont(fs.readFileSync(join(__dirname, '..', '..', 'assets', 'Rubik-Regular.otf')));
    const style: TextStyle = { font, fontSize: 12, spacing: 2, newLineAfter: true };
    const lineHeight = client.getTextDimensions('A', style).height;
    const drawSpy = vi.spyOn(PDFPage.prototype, 'drawText');

    for (let startY = BOTTOM_MARGIN + lineHeight; startY < BOTTOM_MARGIN + 4 * lineHeight; startY += 0.5) {
      client.setY(startY);
      drawSpy.mockClear();
      client.drawText(LONG_TEXT, style);

      const baselines = drawSpy.mock.calls.map(([, options]) => options?.y ?? 0);
      expect(baselines.length).toBeGreaterThan(1);
      baselines.forEach((y) =>
        expect(y - lineHeight, `line started at Y ${startY} lands below the margin`).toBeGreaterThanOrEqual(
          BOTTOM_MARGIN - 0.001
        )
      );
    }
  });
});
