import { describe, expect, it } from 'vitest';
import { mergeEncounterAccounts } from '../src/subscriptions/questionnaire-response/sub-intake-harvest/index';

describe('mergeEncounterAccounts', () => {
  it('returns changed: false when all references are undefined', () => {
    const existing = [{ reference: 'Account/a1' }];
    const result = mergeEncounterAccounts(existing, [undefined, undefined]);
    expect(result.changed).toBe(false);
    expect(result.accounts).toBe(existing);
  });

  it('returns changed: false when references is an empty array', () => {
    const existing = [{ reference: 'Account/a1' }];
    const result = mergeEncounterAccounts(existing, []);
    expect(result.changed).toBe(false);
    expect(result.accounts).toBe(existing);
  });

  it('returns changed: false when all references already exist', () => {
    const existing = [{ reference: 'Account/a1' }, { reference: 'Account/a2' }];
    const result = mergeEncounterAccounts(existing, ['Account/a1', 'Account/a2']);
    expect(result.changed).toBe(false);
    expect(result.accounts).toBe(existing);
  });

  it('adds new references and returns changed: true', () => {
    const existing = [{ reference: 'Account/a1' }];
    const result = mergeEncounterAccounts(existing, ['Account/a2']);
    expect(result.changed).toBe(true);
    expect(result.accounts).toEqual([{ reference: 'Account/a1' }, { reference: 'Account/a2' }]);
  });

  it('handles undefined existing accounts', () => {
    const result = mergeEncounterAccounts(undefined, ['Account/a1']);
    expect(result.changed).toBe(true);
    expect(result.accounts).toEqual([{ reference: 'Account/a1' }]);
  });

  it('handles empty existing accounts array', () => {
    const result = mergeEncounterAccounts([], ['Account/a1']);
    expect(result.changed).toBe(true);
    expect(result.accounts).toEqual([{ reference: 'Account/a1' }]);
  });

  it('does not duplicate references already present', () => {
    const existing = [{ reference: 'Account/a1' }];
    const result = mergeEncounterAccounts(existing, ['Account/a1', 'Account/a2']);
    expect(result.changed).toBe(true);
    expect(result.accounts).toEqual([{ reference: 'Account/a1' }, { reference: 'Account/a2' }]);
  });

  it('filters out undefined values from the references array', () => {
    const result = mergeEncounterAccounts([], [undefined, 'Account/a1', undefined]);
    expect(result.changed).toBe(true);
    expect(result.accounts).toEqual([{ reference: 'Account/a1' }]);
  });

  it('does not mutate the original existing accounts array', () => {
    const existing = [{ reference: 'Account/a1' }];
    const originalLength = existing.length;
    mergeEncounterAccounts(existing, ['Account/a2']);
    expect(existing.length).toBe(originalLength);
  });
});
