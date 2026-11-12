import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  cptCodesToBillForDose,
  deriveVfcEligibility,
  effectiveVfcEligibility,
  isVfcBorrowing,
  sortVaccineLotsForPatient,
  wantedFundingSource,
} from './vfc';

describe('deriveVfcEligibility', () => {
  it('reads Medicaid, self-pay and insurance from the paperwork facts', () => {
    expect(deriveVfcEligibility({ hasMedicaid: true, selfPay: false, hasCoverage: true })?.code).toBe('V02');
    expect(deriveVfcEligibility({ hasMedicaid: false, selfPay: true, hasCoverage: false })?.code).toBe('V03');
    expect(deriveVfcEligibility({ hasMedicaid: false, selfPay: false, hasCoverage: true })?.code).toBe('V01');
  });

  it('Medicaid wins over everything else; self-pay with insurance still on file is insured', () => {
    expect(deriveVfcEligibility({ hasMedicaid: true, selfPay: true, hasCoverage: false })?.code).toBe('V02');
    expect(deriveVfcEligibility({ hasMedicaid: false, selfPay: true, hasCoverage: true })?.code).toBe('V01');
  });

  it('says nothing when the paperwork says nothing', () => {
    expect(deriveVfcEligibility({ hasMedicaid: false, selfPay: false, hasCoverage: false })).toBeUndefined();
  });

  it('explains itself in plain words', () => {
    expect(deriveVfcEligibility({ hasMedicaid: true, selfPay: false, hasCoverage: false })?.why).toMatch(/Medicaid/);
  });
});

describe('effectiveVfcEligibility', () => {
  const on = DateTime.fromISO('2026-11-11');
  it('is the confirmed code when there is one', () => {
    expect(effectiveVfcEligibility('V02', '1990-01-01', on)).toBe('V02');
  });
  it('is not eligible for a patient 19 or older on the day, with nothing confirmed', () => {
    expect(effectiveVfcEligibility(undefined, '2007-11-11', on)).toBe('V01');
    expect(effectiveVfcEligibility(undefined, '1996-03-02', on)).toBe('V01');
  });
  it('is unknown for a child not yet confirmed, or without a birth date', () => {
    expect(effectiveVfcEligibility(undefined, '2007-11-12', on)).toBeUndefined();
    expect(effectiveVfcEligibility(undefined, undefined, on)).toBeUndefined();
    expect(effectiveVfcEligibility(undefined, 'unknown', on)).toBeUndefined();
  });
});

describe('borrowing', () => {
  it('wants VFC stock for an eligible child and private stock otherwise', () => {
    expect(wantedFundingSource('V02')).toBe('vfc');
    expect(wantedFundingSource('V04')).toBe('vfc');
    expect(wantedFundingSource('V01')).toBe('private');
    expect(wantedFundingSource(undefined)).toBe('private');
  });

  it('is borrowing when the stock does not match the eligibility, in either direction', () => {
    expect(isVfcBorrowing('vfc', 'V01')).toBe(true);
    expect(isVfcBorrowing('private', 'V02')).toBe(true);
    expect(isVfcBorrowing('state', 'V01')).toBe(true);
    expect(isVfcBorrowing('vfc', 'V03')).toBe(false);
    expect(isVfcBorrowing('private', 'V01')).toBe(false);
  });

  it('is never borrowing until the eligibility and the stock are both known', () => {
    expect(isVfcBorrowing(undefined, 'V02')).toBe(false);
    expect(isVfcBorrowing('vfc', undefined)).toBe(false);
  });
});

describe('sortVaccineLotsForPatient', () => {
  const lots = [
    { lotNumber: 'P-LATE', expirationDate: '2027-09-30', fundingSource: 'private' as const },
    { lotNumber: 'V-LATE', expirationDate: '2027-06-30', fundingSource: 'vfc' as const },
    { lotNumber: 'V-SOON', expirationDate: '2027-01-31', fundingSource: 'vfc' as const },
    { lotNumber: 'P-SOON', expirationDate: '2026-12-31', fundingSource: 'private' as const },
    { lotNumber: 'V-EXPIRED', expirationDate: '2026-01-01', fundingSource: 'vfc' as const },
    { lotNumber: 'UNTAGGED', expirationDate: '2027-03-31' },
  ];
  const today = '2026-11-11';
  const order = (code: 'V01' | 'V02' | undefined): string[] =>
    sortVaccineLotsForPatient(lots, code, today).map((option) => option.lot.lotNumber);

  it('puts VFC lots first for an eligible child, soonest expiration first, expired last', () => {
    expect(order('V02')).toEqual(['V-SOON', 'V-LATE', 'P-SOON', 'UNTAGGED', 'P-LATE', 'V-EXPIRED']);
  });

  it('puts private lots first for a child who is not eligible; untagged lots count as private', () => {
    expect(order('V01')).toEqual(['P-SOON', 'UNTAGGED', 'P-LATE', 'V-SOON', 'V-LATE', 'V-EXPIRED']);
  });

  it('sorts by expiration alone while eligibility is unknown, and says nothing about matching', () => {
    expect(order(undefined)).toEqual(['P-SOON', 'V-SOON', 'UNTAGGED', 'V-LATE', 'P-LATE', 'V-EXPIRED']);
    expect(sortVaccineLotsForPatient(lots, undefined, today).every((option) => option.matches === undefined)).toBe(
      true
    );
  });

  it('marks which lots match and which are expired', () => {
    const options = sortVaccineLotsForPatient(lots, 'V02', today);
    expect(options.find((option) => option.lot.lotNumber === 'V-SOON')).toMatchObject({
      matches: true,
      expired: false,
    });
    expect(options.find((option) => option.lot.lotNumber === 'P-SOON')).toMatchObject({
      matches: false,
      expired: false,
    });
    expect(options.find((option) => option.lot.lotNumber === 'V-EXPIRED')).toMatchObject({
      matches: true,
      expired: true,
    });
  });
});

describe('cptCodesToBillForDose', () => {
  const codes = [
    { code: '90698', display: 'DTaP-IPV/Hib' },
    { code: '90460', display: 'Admin first component' },
    { code: '90461', display: 'Admin each additional' },
  ];

  it('bills everything for private stock', () => {
    expect(cptCodesToBillForDose(codes, 'private')).toEqual(codes);
    expect(cptCodesToBillForDose(codes, undefined)).toEqual(codes);
  });

  it('drops the vaccine product code for VFC and state stock, keeping the administration codes', () => {
    expect(cptCodesToBillForDose(codes, 'vfc').map((cpt) => cpt.code)).toEqual(['90460', '90461']);
    expect(cptCodesToBillForDose(codes, 'state').map((cpt) => cpt.code)).toEqual(['90460', '90461']);
  });

  it('knows the adult administration codes and the Medicare G codes too', () => {
    const adult = [{ code: '90471' }, { code: '90472' }, { code: 'G0008' }, { code: '90656' }];
    expect(cptCodesToBillForDose(adult, 'vfc').map((cpt) => cpt.code)).toEqual(['90471', '90472', 'G0008']);
  });

  it('keeps the RSV monoclonal antibody administration codes for a VFC dose (nirsevimab 90380 is the product)', () => {
    const nirsevimab = [{ code: '90380' }, { code: '96380' }];
    expect(cptCodesToBillForDose(nirsevimab, 'vfc').map((cpt) => cpt.code)).toEqual(['96380']);
    expect(cptCodesToBillForDose([{ code: '90381' }, { code: '96381' }], 'state').map((cpt) => cpt.code)).toEqual([
      '96381',
    ]);
  });
});
