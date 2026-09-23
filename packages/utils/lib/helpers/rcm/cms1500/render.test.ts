import { PDFDocument, PDFName, PDFPage } from 'pdf-lib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Cms1500FormData } from '../../../types/data/billing/cms1500.types';
import { renderCms1500Pdf } from './render';

const form: Cms1500FormData = {
  insuranceType: 'group',
  patientName: { last: 'Wolfeschlegelsteinhausen', first: 'Hubert' },
  serviceLines: [{ dateFrom: '2026-09-01', procedureCode: '99213', charges: 123456.5 }],
};

// Where text lands on the grid: column c starts (c - 1)/10" from the left, and line n's baseline sits
// 2.5 pt above n/6" from the top.
const at = (line: number, col: number): { x: number; y: number } => ({ x: (col - 1) * 7.2, y: 792 - line * 12 + 2.5 });

describe('renderCms1500Pdf', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints each value on its print line and column, cut off at the edge of its box', async () => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    await renderCms1500Pdf([form]);
    const drawn = drawText.mock.calls.map(([text, options]) => ({ text, x: options?.x, y: options?.y }));

    expect(drawn).toContainEqual({ text: 'WOLFESCHLEGELSTEINHAUSEN, HU', ...at(12, 4) });
    // 1: an X in the Group Health Plan box
    expect(drawn).toContainEqual({ text: 'X', ...at(10, 34) });
    // 24F: amounts are right-aligned on the last column of their box and never cut off
    expect(drawn).toContainEqual({ text: '123456', ...at(46, 52) });
    expect(drawn).toContainEqual({ text: '50', ...at(46, 59) });
  });

  it('shifts the data by the printer offset', async () => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    await renderCms1500Pdf([form], { offset: { x: 3, y: -2 } });
    const name = drawText.mock.calls.find(([text]) => text.startsWith('WOLFESCHLEGEL'))?.[1];
    expect(name).toMatchObject({ x: at(12, 4).x + 3, y: at(12, 4).y + 2 });
  });

  it('renders every form of every claim and asks viewers to print at actual size', async () => {
    const serviceLines = Array.from({ length: 8 }, () => form.serviceLines[0]);
    const doc = await PDFDocument.load(await renderCms1500Pdf([form, { ...form, serviceLines }]));
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
    expect(String(doc.catalog.lookup(PDFName.of('ViewerPreferences')))).toContain('/PrintScaling /None');
  });
});
