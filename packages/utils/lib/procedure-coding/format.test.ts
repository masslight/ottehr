import { describe, expect, it } from 'vitest';
import {
  formatInfusionTimeRange,
  formatProcedureCptCode,
  formatStructuredFacts,
  repairDepthDisplayLabel,
} from './format';
import { PROCEDURE_NAMES } from './procedure-names';

describe('procedure coding display formatting', () => {
  it('formats known and unknown repair-depth values', () => {
    expect(repairDepthDisplayLabel('subcutaneous-layered')).toBe('Subcutaneous — layered closure');
    expect(repairDepthDisplayLabel('legacy-unknown-depth')).toBe('legacy-unknown-depth');
  });

  it.each([
    ['a normal range', '14:05', '14:47', '14:05–14:47 (42 min)'],
    ['a range crossing midnight', '23:50', '00:20', '23:50–00:20 (30 min)'],
    ['a zero-length range', '14:05', '14:05', '14:05–14:05 (0 min)'],
    ['a malformed endpoint', '14:05', '2:5 pm', '14:05–2:5 pm'],
    ['only a start time', '14:05', undefined, '14:05–'],
  ])('formats %s', (_case, start, stop, expected) => {
    expect(formatInfusionTimeRange(start, stop)).toBe(expected);
  });
});

describe('saved procedure findings and CPT lines', () => {
  it('uses field labels, preserves false and zero, and labels each wound', () => {
    const text = formatStructuredFacts(
      { wounds: [{ site: 'trunk', length: 2, closure: 'single layer', edgeDebridement: false, sutureCount: 0 }] },
      PROCEDURE_NAMES.laceration[0]
    );
    expect(text).toContain('Wound 1: Site: trunk; Length (cm): 2; Closure: single layer');
    expect(text).toContain('Wound-edge debridement: No');
    expect(text).toContain('Suture/staple count: 0');
    expect(text).not.toContain('edgeDebridement');
    expect(text).not.toContain('undefined');
  });
  it('does not invent default answers on read-only surfaces or lose unrecognized saved fields', () => {
    expect(formatStructuredFacts({ degree: 'first' }, PROCEDURE_NAMES['burn-treatment'][0])).toBe(
      'Deepest burn degree treated: first'
    );
    expect(formatStructuredFacts({ olderField: false }, 'unknown')).toBe('Older Field: No');
    expect(formatStructuredFacts({ wounds: [{}], count: undefined })).toBe('');
  });
  it('includes modifiers and units without duplicating a bare-code descriptor', () => {
    expect(
      formatProcedureCptCode({
        code: '29125',
        display: '29125',
        billableUnits: 2,
        modifier: [{ code: 'LT', display: 'Left' }],
      })
    ).toBe('29125-LT × 2');
  });
});
