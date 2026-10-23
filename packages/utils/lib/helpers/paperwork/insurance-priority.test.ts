import { Coverage, QuestionnaireResponseItem } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { getInsurancePriorityChanges } from '../../fhir/insurance';
import { isInsuranceCardId, isPrimaryInsuranceCardId, swapPrimarySecondaryInsuranceCardId } from './files-docs';
import { hasInsurancePriorityChange } from './paperwork';

const insuranceSection = (blocks: Record<string, string>): QuestionnaireResponseItem[] => [
  {
    linkId: 'insurance-section',
    item: Object.entries(blocks).map(([linkId, valueString]) => ({ linkId, answer: [{ valueString }] })),
  },
];

const coverage = (id: string): Coverage => ({ id }) as Coverage;

describe('hasInsurancePriorityChange', () => {
  it('is false when priorities are unchanged', () => {
    expect(
      hasInsurancePriorityChange(
        insuranceSection({ 'insurance-priority': 'Primary', 'insurance-priority-2': 'Secondary' })
      )
    ).toBe(false);
  });

  it('detects a swap', () => {
    expect(
      hasInsurancePriorityChange(
        insuranceSection({ 'insurance-priority': 'Secondary', 'insurance-priority-2': 'Primary' })
      )
    ).toBe(true);
  });

  it('detects a single primary insurance changed to secondary', () => {
    expect(hasInsurancePriorityChange(insuranceSection({ 'insurance-priority': 'Secondary' }))).toBe(true);
  });

  it('is false for a secondary-only insurance', () => {
    expect(hasInsurancePriorityChange(insuranceSection({ 'insurance-priority-2': 'Secondary' }))).toBe(false);
  });
});

describe('getInsurancePriorityChanges', () => {
  const a = coverage('a');
  const b = coverage('b');

  it('detects a swap', () => {
    expect(getInsurancePriorityChanges({ primary: a, secondary: b }, { primary: b, secondary: a })).toEqual({
      primaryBecameSecondary: true,
      secondaryBecamePrimary: true,
    });
  });

  it('detects primary moved to secondary', () => {
    expect(getInsurancePriorityChanges({ primary: a }, { secondary: a })).toEqual({
      primaryBecameSecondary: true,
      secondaryBecamePrimary: false,
    });
  });

  it('detects nothing when coverages were already moved (re-submitted form)', () => {
    expect(getInsurancePriorityChanges({ primary: b, secondary: a }, { primary: b, secondary: a })).toEqual({
      primaryBecameSecondary: false,
      secondaryBecamePrimary: false,
    });
  });
});

describe('insurance card ids', () => {
  it('swaps primary and secondary card ids', () => {
    expect(swapPrimarySecondaryInsuranceCardId('insurance-card-front')).toBe('insurance-card-front-2');
    expect(swapPrimarySecondaryInsuranceCardId('insurance-card-back')).toBe('insurance-card-back-2');
    expect(swapPrimarySecondaryInsuranceCardId('insurance-card-front-2')).toBe('insurance-card-front');
    expect(swapPrimarySecondaryInsuranceCardId('insurance-card-back-2')).toBe('insurance-card-back');
  });

  it('recognizes insurance card ids', () => {
    expect(isInsuranceCardId('insurance-card-back-2')).toBe(true);
    expect(isInsuranceCardId('photo-id-front')).toBe(false);
    expect(isInsuranceCardId(undefined)).toBe(false);
    expect(isPrimaryInsuranceCardId('insurance-card-front')).toBe(true);
    expect(isPrimaryInsuranceCardId('insurance-card-front-2')).toBe(false);
  });
});
