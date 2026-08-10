import { describe, expect, it } from 'vitest';
import { defendCodes, detectProcedureFamily, suggestCode } from './evaluate';
import { CPT_RULES_VINTAGE } from './provenance';

describe('family detection', () => {
  it('detects laceration from the procedure type string', () => {
    expect(detectProcedureFamily({ procedureType: 'Laceration Repair (Suturing/Stapling)' })?.id).toBe('laceration');
    expect(detectProcedureFamily({ procedureType: 'laceration-repair' })?.id).toBe('laceration');
  });

  it('detects laceration from a selected repair code alone', () => {
    expect(detectProcedureFamily({ cptCodes: [{ code: '12002', display: 'Simple repair' }] })?.id).toBe('laceration');
    expect(detectProcedureFamily({ cptCodes: [{ code: '13120', display: 'Complex repair' }] })?.id).toBe('laceration');
  });

  it('does not claim suture/staple REMOVAL for the laceration family', () => {
    expect(detectProcedureFamily({ procedureType: 'Staple or Suture Removal' })).toBeUndefined();
  });

  it('detects nothing for unrelated procedures', () => {
    expect(
      detectProcedureFamily({ procedureType: 'X-Ray', cptCodes: [{ code: '73630', display: 'X-ray foot' }] })
    ).toBeUndefined();
  });
});

describe('unknown family results', () => {
  it('suggestCode returns an empty, honest result with selected codes not assessed', () => {
    const result = suggestCode({ procedureType: 'X-Ray', cptCodes: [{ code: '73630', display: 'X-ray foot' }] });
    expect(result.family).toBeUndefined();
    expect(result.suggestion).toBeUndefined();
    expect(result.findings).toHaveLength(0);
    expect(result.notAssessed).toBe(true);
    expect(result.notAssessedCodes).toEqual(['73630']);
  });

  // The no-code types (§12: staple/suture removal, oral rehydration, nasal lavage) deliberately
  // have no family: their care is captured by the visit charge, so the honest default — no
  // suggestion, selected codes not assessed — is exactly right for them.
  it('defendCodes mirrors the same not-assessed behavior for a no-code type', () => {
    const result = defendCodes({
      procedureType: 'Nasal Lavage (schnozzle)',
      cptCodes: [{ code: '99213', display: 'Office visit' }],
    });
    expect(result.family).toBeUndefined();
    expect(result.notAssessedCodes).toEqual(['99213']);
    expect(result.supportedCodes).toHaveLength(0);
  });

  it.each([
    ['Staple or Suture Removal'],
    ['Oral Rehydration / Medication Administration (including challenge doses)'],
    ['Nasal Lavage (schnozzle)'],
  ])('no family claims the no-code type %s', (procedureType) => {
    expect(detectProcedureFamily({ procedureType })).toBeUndefined();
  });
});

describe('laceration family end-to-end through the evaluators', () => {
  const lacerationInput = {
    procedureType: 'Laceration Repair (Suturing/Stapling)',
    bodySite: 'Hand',
    lengthCm: 3.2,
    procedureDetails:
      'Layered closure: deep dermal 4-0 Vicryl, skin closed with running 5-0 nylon, total stitch count: 8.',
    cptCodes: [{ code: '12042', display: 'Intermediate repair 2.6-7.5 cm' }],
  };

  it('suggestCode carries family id and the CPT vintage stamp', () => {
    const result = suggestCode(lacerationInput);
    expect(result.family).toBe('laceration');
    expect(result.rulesVintage).toBe(CPT_RULES_VINTAGE);
    expect(result.suggestion?.code).toBe('12042');
    expect(result.suggestion?.justification).toContain('3.2 cm');
  });

  it('defendCodes supports the matching selected code', () => {
    const result = defendCodes(lacerationInput);
    expect(result.family).toBe('laceration');
    expect(result.supportedCodes).toContain('12042');
    expect(result.rulesVintage).toBe(CPT_RULES_VINTAGE);
  });

  it('mixed selection: in-scope code judged, out-of-family code listed not assessed', () => {
    const result = defendCodes({
      ...lacerationInput,
      cptCodes: [
        { code: '12042', display: 'Intermediate repair 2.6-7.5 cm' },
        { code: '99213', display: 'Office visit' },
      ],
    });
    expect(result.supportedCodes).toContain('12042');
    expect(result.notAssessedCodes).toContain('99213');
  });
});
