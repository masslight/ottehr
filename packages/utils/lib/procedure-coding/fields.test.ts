import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from './evaluate';
import { ekgFamily } from './families/ekg';
import { injectionInfusionFamily } from './families/injection-infusion';
import { lacerationFamily } from './families/laceration';
import {
  clearUnusedStructuredFields,
  ProcedureFieldVisibility,
  procedureFieldVisibility,
  procedureInputFieldVisibility,
  StructuredCodingFields,
} from './fields';

describe('procedureFieldVisibility: the family clause', () => {
  it('offers the length and repair-depth inputs on a laceration, and no infusion times', () => {
    expect(procedureFieldVisibility(lacerationFamily, {})).toEqual({
      length: true,
      repairDepth: true,
      infusionTimes: false,
    });
  });

  it('offers the infusion times on an infusion, and neither wound input', () => {
    expect(procedureFieldVisibility(injectionInfusionFamily, { procedureType: 'IV Fluid Administration' })).toEqual({
      length: false,
      repairDepth: false,
      infusionTimes: true,
    });
  });

  it('offers nothing for a family whose code selection uses none of them', () => {
    expect(procedureFieldVisibility(ekgFamily, {})).toEqual({
      length: false,
      repairDepth: false,
      infusionTimes: false,
    });
  });

  it('offers nothing when no family is detected — an unrecognised entry is not a reason to ask for a wound size', () => {
    expect(procedureFieldVisibility(undefined, {})).toEqual({
      length: false,
      repairDepth: false,
      infusionTimes: false,
    });
  });
});

describe('procedureFieldVisibility: the stored-value clause', () => {
  it('shows a stored length on a family that does not use it, rather than hiding recorded data', () => {
    expect(procedureFieldVisibility(ekgFamily, { lengthCm: 3.2 }).length).toBe(true);
  });

  it('shows a stored repair depth on a family that does not use it', () => {
    expect(procedureFieldVisibility(ekgFamily, { repairDepth: 'subcutaneous-layered' }).repairDepth).toBe(true);
  });

  it.each([
    ['a start time alone', { infusionStartTime: '14:05' }],
    ['a stop time alone', { infusionStopTime: '14:47' }],
    ['both endpoints', { infusionStartTime: '14:05', infusionStopTime: '14:47' }],
  ])('shows stored infusion times given %s', (_label, values) => {
    expect(procedureFieldVisibility(ekgFamily, values).infusionTimes).toBe(true);
  });

  it('treats a zero length as a stored value — 0 is a reading the provider entered, not an absence', () => {
    expect(procedureFieldVisibility(ekgFamily, { lengthCm: 0 }).length).toBe(true);
  });

  it('treats an empty values bag as nothing stored', () => {
    expect(procedureFieldVisibility(ekgFamily, {})).toEqual({
      length: false,
      repairDepth: false,
      infusionTimes: false,
    });
  });

  it('leaves a family that uses the input visible with nothing stored', () => {
    expect(procedureFieldVisibility(lacerationFamily, {}).length).toBe(true);
  });

  it('shows infusion times for IV fluid administration but not for injection or IV push procedure types', () => {
    expect(
      procedureFieldVisibility(injectionInfusionFamily, { procedureType: 'IV Fluid Administration' }).infusionTimes
    ).toBe(true);
    expect(
      procedureFieldVisibility(injectionInfusionFamily, {
        procedureType: 'Intramuscular (IM) Medication Injection',
      }).infusionTimes
    ).toBe(false);
    expect(
      procedureFieldVisibility(injectionInfusionFamily, {
        procedureType: 'IV Push Medication Administration',
      }).infusionTimes
    ).toBe(false);
  });

  it('shows infusion times from a timed-infusion code when an existing entry has no procedure type', () => {
    expect(
      procedureFieldVisibility(injectionInfusionFamily, { cptCodes: [{ code: '96360', display: 'Hydration' }] })
        .infusionTimes
    ).toBe(true);
    expect(
      procedureFieldVisibility(injectionInfusionFamily, { cptCodes: [{ code: '96372', display: 'IM injection' }] })
        .infusionTimes
    ).toBe(false);
  });
});

describe('clearUnusedStructuredFields', () => {
  const allValues = (): StructuredCodingFields => ({
    lengthCm: 3.2,
    repairDepth: 'subcutaneous-layered',
    infusionStartTime: '14:05',
    infusionStopTime: '14:47',
  });

  it('drops every value the visibility says is unused', () => {
    const target = allValues();
    clearUnusedStructuredFields(target, { length: false, repairDepth: false, infusionTimes: false });
    expect(target).toEqual({
      lengthCm: undefined,
      repairDepth: undefined,
      infusionStartTime: undefined,
      infusionStopTime: undefined,
    });
  });

  it('keeps every value the visibility says is used', () => {
    const target = allValues();
    clearUnusedStructuredFields(target, { length: true, repairDepth: true, infusionTimes: true });
    expect(target).toEqual(allValues());
  });

  it('clears both infusion endpoints together — half a time range is not a range', () => {
    const target: StructuredCodingFields = { infusionStartTime: '14:05', infusionStopTime: '14:47' };
    clearUnusedStructuredFields(target, { length: true, repairDepth: true, infusionTimes: false });
    expect(target.infusionStartTime).toBeUndefined();
    expect(target.infusionStopTime).toBeUndefined();
  });

  it('clears field by field, not wholesale', () => {
    const target = allValues();
    clearUnusedStructuredFields(target, { length: true, repairDepth: false, infusionTimes: false });
    expect(target.lengthCm).toBe(3.2);
    expect(target.repairDepth).toBeUndefined();
    expect(target.infusionStartTime).toBeUndefined();
  });
});

describe('the regression this predicate exists for', () => {
  function visibilityOnSwitch(procedureType: string): ProcedureFieldVisibility {
    const input = { procedureType };
    return procedureInputFieldVisibility(detectProcedureFamily(input), input);
  }

  it('a wound size entered on a laceration does not survive a switch to EKG', () => {
    const target: StructuredCodingFields = { lengthCm: 3.2, repairDepth: 'subcutaneous-layered' };
    clearUnusedStructuredFields(target, visibilityOnSwitch('EKG'));
    expect(target.lengthCm).toBeUndefined();
    expect(target.repairDepth).toBeUndefined();
  });

  it('infusion times entered on an infusion do not survive a switch to a laceration', () => {
    const target: StructuredCodingFields = { infusionStartTime: '14:05', infusionStopTime: '14:47' };
    clearUnusedStructuredFields(target, visibilityOnSwitch('Laceration Repair'));
    expect(target.infusionStartTime).toBeUndefined();
    expect(target.infusionStopTime).toBeUndefined();
  });

  it('a wound size survives a switch between two families that both band on it', () => {
    const target: StructuredCodingFields = { lengthCm: 3.2 };
    clearUnusedStructuredFields(target, visibilityOnSwitch('Incision and Drainage (I&D) of Abscess'));
    expect(target.lengthCm).toBe(3.2);
  });

  it('passing `values` to the clearing decision would let a stale value justify its own survival', () => {
    const stale = { lengthCm: 3.2 };
    const withValues = procedureFieldVisibility(detectProcedureFamily({ procedureType: 'EKG' }), {
      procedureType: 'EKG',
      ...stale,
    });
    expect(withValues.length).toBe(true);
    clearUnusedStructuredFields(stale, withValues);
    expect(stale.lengthCm).toBe(3.2);
  });
});
