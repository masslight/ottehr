import { Account, QuestionnaireResponseItem } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { getCoverageSlotChanges } from '../../fhir/insurance';
import { isInsuranceCardId, isPrimaryInsuranceCardId, swapPrimarySecondaryInsuranceCardId } from './files-docs';
import { getRequestedInsurancePriorityChanges, hasInsurancePriorityChange } from './paperwork';

const insuranceSection = (blocks: Record<string, string>): QuestionnaireResponseItem[] => [
  {
    linkId: 'insurance-section',
    item: Object.entries(blocks).map(([linkId, valueString]) => ({ linkId, answer: [{ valueString }] })),
  },
];

const account = (primary?: string, secondary?: string): Account => ({
  resourceType: 'Account',
  status: 'active',
  coverage: [
    ...(primary ? [{ coverage: { reference: `Coverage/${primary}` }, priority: 1 }] : []),
    ...(secondary ? [{ coverage: { reference: `Coverage/${secondary}` }, priority: 2 }] : []),
  ],
});

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

describe('getRequestedInsurancePriorityChanges', () => {
  it('reads the requested direction per insurance block', () => {
    expect(getRequestedInsurancePriorityChanges(insuranceSection({ 'insurance-priority': 'Secondary' }))).toEqual({
      primaryBecameSecondary: true,
      secondaryBecamePrimary: false,
    });
  });
});

describe('getCoverageSlotChanges', () => {
  const bothChanged = { primaryCoverageChanged: true, secondaryCoverageChanged: true };
  const nothingChanged = { primaryCoverageChanged: false, secondaryCoverageChanged: false };

  it('detects a swap', () => {
    expect(getCoverageSlotChanges(account('a', 'b'), account('b', 'a'))).toEqual(bothChanged);
  });

  it('detects primary moved to secondary', () => {
    expect(getCoverageSlotChanges(account('a'), account(undefined, 'a'))).toEqual({
      primaryCoverageChanged: false,
      secondaryCoverageChanged: true,
    });
  });

  it('detects a new coverage promoted to primary', () => {
    expect(getCoverageSlotChanges(account('a'), account('b', 'a'))).toEqual(bothChanged);
  });

  it('detects a replaced coverage (corrected member ID)', () => {
    expect(getCoverageSlotChanges(account('a', 'b'), account('b', 'a2'))).toEqual(bothChanged);
  });

  it('detects nothing when the coverages were already moved (re-submitted form)', () => {
    expect(getCoverageSlotChanges(account('b', 'a'), account('b', 'a'))).toEqual(nothingChanged);
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
