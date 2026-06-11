import * as fs from 'fs';
import { join } from 'path';
import { PDFPage } from 'pdf-lib';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ICON_STYLE, PDF_CLIENT_STYLES } from '../../src/shared/pdf/pdf-consts';
import { createPdfClient } from '../../src/shared/pdf/pdf-utils';
import { PdfClient, TextStyle } from '../../src/shared/pdf/types';

/**
 * Regression test for a "Maximum call stack size exceeded" crash in the visit
 * note PDF.
 *
 * In the Labs section the test name and its flag ("Abnormal"/"Inconclusive")
 * share a line, and the flag's leftBound is the current cursor X
 * (renderLabsSection's getCurBounds). When a long name wraps to the right
 * margin the flag gets a column narrower than a glyph, and drawTextSequential
 * recursed on the same text without progress until the stack overflowed.
 *
 * Geometry matches the progress note PDF: A4 (595.28w), 40pt margins -> column
 * [40, 555.28].
 */
describe('visit note Labs PDF — flag rendering in a narrow column', () => {
  let client: PdfClient;
  let regularText: TextStyle;
  let regularTextNoLineAfter: TextStyle;

  // Long lab name that wraps to the right margin, leaving the flag a sliver
  // column. Length matters: it sets where the last line breaks.
  const SYNTHETIC_LAB_NAME = '(CODE01) Generic Sample Panel (Test Code: CODE01) / TestLab12';

  beforeEach(async () => {
    // Silence chatty logs so a pre-fix runaway recursion doesn't flood output.
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    client = await createPdfClient(PDF_CLIENT_STYLES);
    const font = await client.embedFont(fs.readFileSync(join(__dirname, '..', '..', 'assets', 'Rubik-Regular.otf')));
    // Mirrors createProgressNoteStyles().textStyles.regularText
    regularText = { fontSize: 16, spacing: 1, font, newLineAfter: true };
    regularTextNoLineAfter = { ...regularText, newLineAfter: false };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('drawTextSequential terminates when the column is narrower than a single glyph', () => {
    // Sub-glyph column: deterministic regardless of font metrics. Pre-fix this
    // recurses forever -> RangeError; post-fix it returns.
    const rightBound = client.getRightBound();
    const leftBound = rightBound - 4;

    expect(() =>
      client.drawTextSequential('Abnormal', regularTextNoLineAfter, { leftBound, rightBound })
    ).not.toThrow();
  });

  test('renders the full text in one piece when the column is narrower than a glyph (no data loss)', () => {
    // Verify the text is committed to the page as a single fragment, not
    // dropped or mangled into one glyph per line.
    const drawSpy = vi.spyOn(PDFPage.prototype, 'drawText');

    const rightBound = client.getRightBound();
    const leftBound = rightBound - 4; // sub-glyph column

    client.drawTextSequential('Abnormal', regularTextNoLineAfter, { leftBound, rightBound });

    const drawnFragments = drawSpy.mock.calls.map((c) => c[0]).filter((t): t is string => typeof t === 'string');
    expect(drawnFragments).toContain('Abnormal');
  });

  test('flagged lab result whose long name wraps to the right margin does not overflow the stack', () => {
    // Replicate renderLabsSection.drawResultFlags: name (no trailing newline),
    // then the flag drawn into the leftover width (getCurBounds()).
    client.drawTextSequential(SYNTHETIC_LAB_NAME, regularTextNoLineAfter, {
      leftBound: client.getLeftBound(),
      rightBound: client.getRightBound(),
    });
    // The flag icon (ICON_STYLE width + 5px L/R margins) advances the cursor.
    client.setX(client.getX() + ICON_STYLE.width + 10);

    expect(() =>
      client.drawTextSequential('Abnormal', regularTextNoLineAfter, {
        leftBound: client.getX(),
        rightBound: client.getRightBound(),
      })
    ).not.toThrow();
  });
});
