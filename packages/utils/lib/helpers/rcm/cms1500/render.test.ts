import { PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { Cms1500FormData, Cms1500ServiceLine } from '../../../types/data/billing/cms1500.types';
import { CMS1500_LAYOUT, Cms1500Field } from './layout';
import { Cms1500TextRun, layoutCms1500Pages, renderCms1500Pdf } from './render';

const serviceLine = (overrides: Partial<Cms1500ServiceLine> = {}): Cms1500ServiceLine => ({
  dateFrom: '2026-09-01',
  placeOfService: '11',
  procedureCode: '99213',
  modifiers: ['25'],
  diagnosisPointers: [1, 2],
  charges: 150,
  units: 1,
  renderingProviderNpi: '1987654329',
  ...overrides,
});

const form: Cms1500FormData = {
  insuranceType: 'group',
  insuredId: 'W123456789',
  patientName: { last: 'Doe', first: 'Jane', middle: 'Alice' },
  patientBirthDate: '1980-01-15',
  patientSex: 'F',
  patientRelationshipToInsured: 'self',
  diagnosisCodes: ['J06.9', 'R05.9'],
  serviceLines: [serviceLine()],
  federalTaxId: { value: '12-3456789', type: 'EIN' },
  acceptAssignment: true,
  amountPaid: 25,
};

// Text at a grid cell, e.g. at(runs, 12, 4) for the patient name.
const at = (runs: Cms1500TextRun[], line: number, col: number): string | undefined =>
  runs.find((run) => run.line === line && run.col === col)?.text;

describe('layoutCms1500Pages', () => {
  it('places claim values in their boxes', () => {
    const [page] = layoutCms1500Pages(form);
    expect(at(page, 10, 34)).toBe('X'); // 1 group health plan
    expect(at(page, 10, 53)).toBe('W123456789'); // 1a
    expect(at(page, 12, 4)).toBe('DOE, JANE, A'); // 2
    expect([at(page, 12, 34), at(page, 12, 37), at(page, 12, 40)]).toEqual(['01', '15', '1980']); // 3
    expect(at(page, 12, 50)).toBe('X'); // 3 F
    expect(at(page, 14, 36)).toBe('X'); // 6 self
    expect(at(page, 39, 45)).toBe('0'); // 21 ICD-10 indicator
    expect([at(page, 40, 6), at(page, 40, 19)]).toEqual(['J069', 'R059']); // 21 A, B
    expect(at(page, 58, 4)).toBe('123456789'); // 25
    expect(at(page, 58, 22)).toBe('X'); // 25 EIN
    expect(at(page, 58, 41)).toBe('X'); // 27 yes
  });

  it('answers NO to the condition and outside lab questions unless the claim says otherwise', () => {
    const [page] = layoutCms1500Pages(form);
    [22, 24, 26].forEach((line) => expect(at(page, line, 44)).toBe('X'));
    expect(at(page, 38, 60)).toBe('X');

    const [accident] = layoutCms1500Pages({
      ...form,
      conditionRelatedTo: { autoAccident: true, autoAccidentState: 'MA' },
    });
    expect(at(accident, 24, 38)).toBe('X');
    expect(at(accident, 24, 44)).toBeUndefined();
    expect(at(accident, 24, 48)).toBe('MA');
  });

  it('prints a service line on the grid with right-aligned dollars and the From date repeated', () => {
    const [page] = layoutCms1500Pages({ ...form, serviceLines: [serviceLine({ charges: 1234.5 })] });
    const line = 46;
    expect([at(page, line, 4), at(page, line, 7), at(page, line, 10)]).toEqual(['09', '01', '26']);
    expect([at(page, line, 13), at(page, line, 16), at(page, line, 19)]).toEqual(['09', '01', '26']);
    expect(at(page, line, 22)).toBe('11');
    expect(at(page, line, 28)).toBe('99213');
    expect(at(page, line, 35)).toBe('25');
    expect(at(page, line, 48)).toBe('AB');
    expect(at(page, line, 54)).toBe('1234'); // ends in column 57
    expect(at(page, line, 59)).toBe('50');
    expect(at(page, line, 62)).toBe('1');
    expect(at(page, line, 71)).toBe('1987654329');
    // 28: total of the page's lines, dollars ending in column 60
    expect(at(page, 58, 57)).toBe('1234');
    expect(at(page, 58, 61)).toBe('50');
  });

  it('continues past six service lines on another form with its own total', () => {
    const lines = Array.from({ length: 7 }, (_, i) => serviceLine({ charges: 10 * (i + 1) }));
    const pages = layoutCms1500Pages({ ...form, serviceLines: lines });
    expect(pages).toHaveLength(2);
    // 10 + 20 + ... + 60 on the first form, 70 on the second
    expect(at(pages[0], 58, 58)).toBe('210');
    expect(at(pages[1], 58, 59)).toBe('70');
    expect(at(pages[1], 46, 28)).toBe('99213');
    expect(at(pages[1], 48, 28)).toBeUndefined();
    // The amount paid is reported once, and the claim-level items repeat.
    expect(at(pages[0], 58, 69)).toBe('25');
    expect(pages[1].some((run) => run.line === 58 && run.col >= 67 && run.col <= 72)).toBe(false);
    expect(at(pages[1], 12, 4)).toBe('DOE, JANE, A');
  });

  it('still produces one form for a claim without service lines', () => {
    const pages = layoutCms1500Pages({ ...form, serviceLines: [] });
    expect(pages).toHaveLength(1);
    expect(pages[0].some((run) => run.line === 58 && run.col >= 55 && run.col <= 62)).toBe(false);
  });

  it('cuts text off at the edge of its box', () => {
    const [page] = layoutCms1500Pages({ ...form, patientName: { last: 'Wolfeschlegelsteinhausen', first: 'Hubert' } });
    expect(at(page, 12, 4)).toHaveLength(CMS1500_LAYOUT.patientName.width);
  });
});

describe('CMS1500_LAYOUT', () => {
  const collect = (value: unknown, found: Cms1500Field[] = []): Cms1500Field[] => {
    if (value && typeof value === 'object') {
      if ('line' in value && 'col' in value && 'width' in value) found.push(value as Cms1500Field);
      else Object.values(value).forEach((child) => collect(child, found));
    }
    return found;
  };
  const { serviceLines, ...claimLevel } = CMS1500_LAYOUT;
  const serviceLineFields = collect(serviceLines);
  const fields = [
    ...collect(claimLevel),
    ...Array.from({ length: serviceLines.count }, (_, i) =>
      serviceLineFields.map((field) => ({
        ...field,
        line: field.line + serviceLines.firstLine + i * serviceLines.lineStep,
      }))
    ).flat(),
  ];

  it('keeps every field on the page', () => {
    fields.forEach((field) => {
      expect(field.line).toBeGreaterThanOrEqual(1);
      expect(field.line).toBeLessThanOrEqual(66);
      expect(field.col).toBeGreaterThanOrEqual(1);
      expect(field.col + field.width - 1).toBeLessThanOrEqual(85);
    });
  });

  it('never lets two fields share a character cell', () => {
    const taken = new Map<string, Cms1500Field>();
    fields.forEach((field) => {
      for (let col = field.col; col < field.col + field.width; col++) {
        const cell = `${field.line}:${col}`;
        expect(taken.get(cell), `cell ${cell}`).toBeUndefined();
        taken.set(cell, field);
      }
    });
  });
});

describe('renderCms1500Pdf', () => {
  it('renders every form of every claim and asks viewers to print at actual size', async () => {
    const bytes = await renderCms1500Pdf([
      form,
      { ...form, serviceLines: Array.from({ length: 8 }, () => serviceLine()) },
    ]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
    const preferences = doc.catalog.lookup(PDFName.of('ViewerPreferences'));
    expect(String(preferences)).toContain('/PrintScaling /None');
  });

  it('leaves the form out for pre-printed paper', async () => {
    const withForm = await renderCms1500Pdf([form]);
    const dataOnly = await renderCms1500Pdf([form], { includeForm: false, offset: { x: 3, y: -2 } });
    expect(dataOnly.length).toBeLessThan(withForm.length / 2);
  });
});
