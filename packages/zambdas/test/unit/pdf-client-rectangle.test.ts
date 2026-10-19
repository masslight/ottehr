import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, test } from 'vitest';
import { PDF_CLIENT_STYLES } from '../../src/shared/pdf/pdf-consts';
import { createPdfClient, rgbNormalized } from '../../src/shared/pdf/pdf-utils';

const STRIPE = rgbNormalized(240, 240, 240);

describe('PdfClient.drawFilledRectangle', () => {
  test('produces a readable PDF', async () => {
    const pdfClient = await createPdfClient(PDF_CLIENT_STYLES);
    const font = await pdfClient.embedStandardFont(StandardFonts.Helvetica);

    pdfClient.drawFilledRectangle({
      x: pdfClient.getLeftBound(),
      y: pdfClient.getY(),
      width: pdfClient.getRightBound() - pdfClient.getLeftBound(),
      height: 16,
      color: STRIPE,
    });
    pdfClient.drawText('Row drawn on top of its background', {
      font,
      fontSize: 10,
      spacing: 4,
      newLineAfter: true,
    });

    const bytes = await pdfClient.save();
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    await expect(PDFDocument.load(bytes)).resolves.toBeDefined();

    // A background that renders nothing would still produce a loadable PDF, so compare against the
    // same document without one.
    const withoutRectangle = await createPdfClient(PDF_CLIENT_STYLES);
    withoutRectangle.drawText('Row drawn on top of its background', {
      font: await withoutRectangle.embedStandardFont(StandardFonts.Helvetica),
      fontSize: 10,
      spacing: 4,
      newLineAfter: true,
    });
    expect(bytes.length).toBeGreaterThan((await withoutRectangle.save()).length);
  });

  test('leaves the cursor where it was, so the caller still controls layout', async () => {
    const pdfClient = await createPdfClient(PDF_CLIENT_STYLES);
    const y = pdfClient.getY();
    const x = pdfClient.getX();

    pdfClient.drawFilledRectangle({
      x: pdfClient.getLeftBound(),
      y: y - 4,
      width: 100,
      height: 16,
      color: STRIPE,
    });

    expect(pdfClient.getY()).toBe(y);
    expect(pdfClient.getX()).toBe(x);
  });

  test('paints onto the page the client is currently on', async () => {
    const pdfClient = await createPdfClient(PDF_CLIENT_STYLES);
    pdfClient.addNewPage(PDF_CLIENT_STYLES.initialPage);
    expect(pdfClient.getCurrentPageIndex()).toBe(1);

    pdfClient.drawFilledRectangle({
      x: pdfClient.getLeftBound(),
      y: pdfClient.getY(),
      width: 100,
      height: 16,
      color: STRIPE,
    });

    // Drawing a background must not add or switch pages behind the caller's back.
    expect(pdfClient.getTotalPages()).toBe(2);
    expect(pdfClient.getCurrentPageIndex()).toBe(1);
  });
});
