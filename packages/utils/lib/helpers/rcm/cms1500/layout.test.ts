import { describe, expect, it } from 'vitest';
import { CMS1500_BOXES, CMS1500_LAYOUT, cms1500BoxName } from './layout';

// Character cells a box takes up, as [line, col]
const cellsOf = ({ box }: (typeof CMS1500_BOXES)[number]): [number, number][] =>
  'cols' in box
    ? Object.values<number>(box.cols).map((col) => [box.line, col])
    : Array.from({ length: box.width }, (_, i) => [box.line, box.col + i]);

describe('CMS1500_BOXES', () => {
  it('has every box once, with the service lines numbered from 1', () => {
    const names = CMS1500_BOXES.map(({ name }) => name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining([
        'carrier.1',
        'insuranceType',
        'patientBirthDate.mm',
        'diagnosisCodes.12',
        'serviceLines.1.dateFrom.mm',
        'serviceLines.6.charges.dollars',
        'serviceLines.6.modifiers.4',
        'billingProvider.3',
      ])
    );
  });

  it('keeps every box on the page', () => {
    CMS1500_BOXES.flatMap(cellsOf).forEach(([line, col]) => {
      expect(line).toBeGreaterThanOrEqual(1);
      expect(line).toBeLessThanOrEqual(66);
      expect(col).toBeGreaterThanOrEqual(1);
      expect(col).toBeLessThanOrEqual(85);
    });
  });

  it('never lets two boxes share a character cell', () => {
    const taken = new Map<string, string>();
    CMS1500_BOXES.forEach((named) => {
      cellsOf(named).forEach(([line, col]) => {
        const cell = `${line}:${col}`;
        expect(taken.get(cell), `cell ${cell} of ${named.name}`).toBeUndefined();
        taken.set(cell, named.name);
      });
    });
  });

  it('prints each service line two lines below the one before', () => {
    const lineOf = (name: string): number | undefined => CMS1500_BOXES.find((box) => box.name === name)?.box.line;
    expect(lineOf('serviceLines.1.procedureCode')).toBe(46);
    expect(lineOf('serviceLines.2.procedureCode')).toBe(48);
    expect(lineOf('serviceLines.6.supplementalInformation')).toBe(55);
  });
});

describe('cms1500BoxName', () => {
  it('names claim boxes by their path and service line boxes relative to their line', () => {
    expect(cms1500BoxName(CMS1500_LAYOUT.otherDate.qualifier)).toBe('otherDate.qualifier');
    expect(cms1500BoxName(CMS1500_LAYOUT.serviceLines.charges.cents)).toBe('charges.cents');
    expect(() => cms1500BoxName({ line: 1, col: 1, width: 1 })).toThrow();
  });
});
