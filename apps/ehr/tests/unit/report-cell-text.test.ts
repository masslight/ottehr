import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { cellText } from '../../src/features/report-builder/runtime/components/format';

describe('cellText', () => {
  it('reads an element in a cell as its text, for sorting, filtering and CSV export', () => {
    expect(cellText(createElement('a', null, 'View visit'))).toBe('View visit');
    expect(cellText(createElement('span', null, 'Visit ', createElement('b', null, 42), false))).toBe('Visit 42');
  });

  it('falls back to the label of a label-only element (e.g. MUI Chip)', () => {
    const Chip = (): null => null;
    expect(cellText(createElement(Chip, { label: 'Final' }))).toBe('Final');
  });

  it('keeps plain objects readable', () => {
    expect(cellText({ a: 1, b: null })).toBe('a: 1');
  });
});
