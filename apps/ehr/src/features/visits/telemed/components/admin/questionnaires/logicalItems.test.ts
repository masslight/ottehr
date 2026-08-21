import { PracticeManagedQuestionnaireItem } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { describe, expect, it } from 'vitest';
import { isLogicalItem, LOGICAL_ITEM_LABELS, logicalItemLabel } from './logicalItems';

const item = (overrides: Partial<PracticeManagedQuestionnaireItem>): PracticeManagedQuestionnaireItem =>
  ({ _key: 'k'.repeat(8), linkId: 'x', type: 'string', ...overrides }) as PracticeManagedQuestionnaireItem;

describe('isLogicalItem', () => {
  it('is true for a read-only item whose linkId is a known logical key', () => {
    expect(isLogicalItem(item({ linkId: 'reason-for-visit', type: 'string', readOnly: true }))).toBe(true);
    expect(isLogicalItem(item({ linkId: 'patient-will-be-18', type: 'boolean', readOnly: true }))).toBe(true);
  });

  it('is false for an editable field that shares a logical linkId (not read-only)', () => {
    // the real editable patient-first-name (booking / patient-record forms) must stay editable
    expect(isLogicalItem(item({ linkId: 'patient-first-name', type: 'string', text: 'First name' }))).toBe(false);
    expect(isLogicalItem(item({ linkId: 'patient-first-name', type: 'string', readOnly: false }))).toBe(false);
  });

  it('is false for a read-only item whose linkId is not a logical key', () => {
    expect(isLogicalItem(item({ linkId: 'some-custom-field', type: 'string', readOnly: true }))).toBe(false);
  });
});

describe('logicalItemLabel', () => {
  it('maps a known logical linkId to its friendly label', () => {
    expect(logicalItemLabel('appointment-service-category')).toBe(LOGICAL_ITEM_LABELS['appointment-service-category']);
    expect(logicalItemLabel('reason-for-visit')).toBe('Reason for visit');
  });

  it('falls back to the linkId (or empty) when unknown', () => {
    expect(logicalItemLabel('unknown-linkid')).toBe('unknown-linkid');
    expect(logicalItemLabel(undefined)).toBe('');
  });
});
