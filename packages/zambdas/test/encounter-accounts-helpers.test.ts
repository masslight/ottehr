import { Account, Encounter } from 'fhir/r4b';
import { OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE, PATIENT_BILLING_ACCOUNT_TYPE, WORKERS_COMP_ACCOUNT_TYPE } from 'utils';
import { describe, expect, it } from 'vitest';
import { makeEncounterAccountPatchOp, mergeEncounterAccounts, organizeAccounts } from '../src/ehr/shared/harvest';

const makeAccount = (id: string, type: Account['type']): Account => ({
  resourceType: 'Account',
  id,
  status: 'active',
  type,
});

const makeEncounter = (accountRefs?: string[]): Encounter => ({
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'in-progress',
  class: {
    system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
    code: 'ACUTE',
    display: 'inpatient acute',
  },
  ...(accountRefs !== undefined && { account: accountRefs.map((reference) => ({ reference })) }),
});

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

describe('organizeAccounts', () => {
  it('returns all undefined when given an empty array', () => {
    const result = organizeAccounts([]);
    expect(result.existingAccount).toBeUndefined();
    expect(result.workersCompAccount).toBeUndefined();
    expect(result.occupationalMedicineAccount).toBeUndefined();
  });

  it('assigns a PATIENT_BILLING account to existingAccount', () => {
    const account = makeAccount('a1', PATIENT_BILLING_ACCOUNT_TYPE);
    const result = organizeAccounts([account]);
    expect(result.existingAccount).toBe(account);
    expect(result.workersCompAccount).toBeUndefined();
    expect(result.occupationalMedicineAccount).toBeUndefined();
  });

  it('assigns a WORKERS_COMP account to workersCompAccount', () => {
    const account = makeAccount('a1', WORKERS_COMP_ACCOUNT_TYPE);
    const result = organizeAccounts([account]);
    expect(result.workersCompAccount).toBe(account);
    expect(result.existingAccount).toBeUndefined();
    expect(result.occupationalMedicineAccount).toBeUndefined();
  });

  it('assigns an OCCUPATIONAL_MEDICINE account to occupationalMedicineAccount', () => {
    const account = makeAccount('a1', OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE);
    const result = organizeAccounts([account]);
    expect(result.occupationalMedicineAccount).toBe(account);
    expect(result.existingAccount).toBeUndefined();
    expect(result.workersCompAccount).toBeUndefined();
  });

  it('assigns all three accounts when all types are present', () => {
    const billingAccount = makeAccount('a1', PATIENT_BILLING_ACCOUNT_TYPE);
    const workersCompAccount = makeAccount('a2', WORKERS_COMP_ACCOUNT_TYPE);
    const occMedAccount = makeAccount('a3', OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE);
    const result = organizeAccounts([billingAccount, workersCompAccount, occMedAccount]);
    expect(result.existingAccount).toBe(billingAccount);
    expect(result.workersCompAccount).toBe(workersCompAccount);
    expect(result.occupationalMedicineAccount).toBe(occMedAccount);
  });

  it('falls back to a plain (non-workers-comp, non-occ-med) account when no PATIENT_BILLING account exists', () => {
    const plainAccount = makeAccount('a1', {
      coding: [{ system: 'http://example.com', code: 'OTHER' }],
    });
    const result = organizeAccounts([plainAccount]);
    expect(result.existingAccount).toBe(plainAccount);
    expect(result.workersCompAccount).toBeUndefined();
    expect(result.occupationalMedicineAccount).toBeUndefined();
  });

  it('does not use workers comp account as fallback existingAccount', () => {
    const workersCompAccount = makeAccount('a1', WORKERS_COMP_ACCOUNT_TYPE);
    const result = organizeAccounts([workersCompAccount]);
    expect(result.existingAccount).toBeUndefined();
    expect(result.workersCompAccount).toBe(workersCompAccount);
  });

  it('does not use occupational medicine account as fallback existingAccount', () => {
    const occMedAccount = makeAccount('a1', OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE);
    const result = organizeAccounts([occMedAccount]);
    expect(result.existingAccount).toBeUndefined();
    expect(result.occupationalMedicineAccount).toBe(occMedAccount);
  });

  it('prefers PATIENT_BILLING account over fallback when both are present', () => {
    const billingAccount = makeAccount('a1', PATIENT_BILLING_ACCOUNT_TYPE);
    const plainAccount = makeAccount('a2', {
      coding: [{ system: 'http://example.com', code: 'OTHER' }],
    });
    const result = organizeAccounts([plainAccount, billingAccount]);
    expect(result.existingAccount).toBe(billingAccount);
  });

  it('uses the plain fallback when only workers comp and plain accounts exist', () => {
    const workersCompAccount = makeAccount('a1', WORKERS_COMP_ACCOUNT_TYPE);
    const plainAccount = makeAccount('a2', {
      coding: [{ system: 'http://example.com', code: 'OTHER' }],
    });
    const result = organizeAccounts([workersCompAccount, plainAccount]);
    expect(result.existingAccount).toBe(plainAccount);
    expect(result.workersCompAccount).toBe(workersCompAccount);
  });

  it('returns all undefined when account has no type coding', () => {
    const account: Account = { resourceType: 'Account', id: 'a1', status: 'active' };
    const result = organizeAccounts([account]);
    expect(result.existingAccount).toBe(account);
  });
});

describe('makeEncounterAccountPatchOp', () => {
  it('returns empty ops when both account and workersCompAccount are undefined', () => {
    const encounter = makeEncounter();
    const ops = makeEncounterAccountPatchOp(encounter, undefined, undefined);
    expect(ops).toHaveLength(0);
  });

  it('returns empty ops for encounter with existing account and both account and workersCompAccount are undefined', () => {
    const encounter = makeEncounter(['Account/existing']);
    const ops = makeEncounterAccountPatchOp(encounter, undefined, undefined);
    expect(ops).toHaveLength(0);
  });

  it('returns an add op when encounter has no account and a new account is provided', () => {
    const encounter = makeEncounter();
    const account = makeAccount('a1', PATIENT_BILLING_ACCOUNT_TYPE);
    const ops = makeEncounterAccountPatchOp(encounter, account, undefined);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: 'add', path: '/account', value: [{ reference: 'Account/a1' }] });
  });

  it('returns an add op with both account references when encounter has no account', () => {
    const encounter = makeEncounter();
    const account = makeAccount('a1', PATIENT_BILLING_ACCOUNT_TYPE);
    const workersCompAccount = makeAccount('a2', WORKERS_COMP_ACCOUNT_TYPE);
    const ops = makeEncounterAccountPatchOp(encounter, account, workersCompAccount);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      op: 'add',
      value: [{ reference: 'Account/a1' }, { reference: 'Account/a2' }],
    });
  });

  it('returns a replace op when encounter already has accounts and a new reference is added', () => {
    const encounter = makeEncounter(['Account/existing']);
    const account = makeAccount('a1', PATIENT_BILLING_ACCOUNT_TYPE);
    const ops = makeEncounterAccountPatchOp(encounter, account, undefined);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      op: 'replace',
      path: '/account',
      value: [{ reference: 'Account/existing' }, { reference: 'Account/a1' }],
    });
  });

  it('returns empty ops when all references already exist on the encounter', () => {
    const encounter = makeEncounter(['Account/a1', 'Account/a2']);
    const account = makeAccount('a1', PATIENT_BILLING_ACCOUNT_TYPE);
    const workersCompAccount = makeAccount('a2', WORKERS_COMP_ACCOUNT_TYPE);
    const ops = makeEncounterAccountPatchOp(encounter, account, workersCompAccount);
    expect(ops).toHaveLength(0);
  });

  it('returns only the workersComp reference when account is undefined', () => {
    const encounter = makeEncounter();
    const workersCompAccount = makeAccount('a2', WORKERS_COMP_ACCOUNT_TYPE);
    const ops = makeEncounterAccountPatchOp(encounter, undefined, workersCompAccount);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: 'add', value: [{ reference: 'Account/a2' }] });
  });

  it('returns empty ops when account has no id and workersCompAccount is undefined', () => {
    const encounter = makeEncounter();
    const accountNoId: Account = { resourceType: 'Account', status: 'active', type: PATIENT_BILLING_ACCOUNT_TYPE };
    const ops = makeEncounterAccountPatchOp(encounter, accountNoId, undefined);
    expect(ops).toHaveLength(0);
  });

  it('returns a replace op when only workersComp reference is new and encounter has existing accounts', () => {
    const encounter = makeEncounter(['Account/a1']);
    const account = makeAccount('a1', PATIENT_BILLING_ACCOUNT_TYPE);
    const workersCompAccount = makeAccount('a2', WORKERS_COMP_ACCOUNT_TYPE);
    const ops = makeEncounterAccountPatchOp(encounter, account, workersCompAccount);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      op: 'replace',
      value: [{ reference: 'Account/a1' }, { reference: 'Account/a2' }],
    });
  });
});
