import { describe, expect, it } from 'vitest';
import { defendCodes, detectProcedureFamily, suggestCode } from './evaluate';
import { EvaluationFamilyMatchKind } from './model.types';
import { CPT_RULES_VINTAGE } from './provenance';
import { isNotAssessed, notAssessedCodes, suggestionOf, supportedCodes } from './test-support';

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

  it.each([
    ['Incision and Drainage (I&D) of Abscess', '12002', 'incision-drainage'],
    ['Foreign Body Removal (Skin, Ear, Nose, Eye)', '12001', 'foreign-body'],
    ['Ear Lavage / Cerumen Removal', '13120', 'cerumen'],
    ['EKG', '12042', 'ekg'],
  ])('procedure type %s wins over a mis-selected %s', (procedureType, code, expectedFamily) => {
    expect(detectProcedureFamily({ procedureType, cptCodes: [{ code, display: 'mis-selected' }] })?.id).toBe(
      expectedFamily
    );
  });

  it('still falls back to the selected code when no family claims the type', () => {
    expect(detectProcedureFamily({ procedureType: '', cptCodes: [{ code: '10060', display: 'I&D simple' }] })?.id).toBe(
      'incision-drainage'
    );
  });

  it.each([
    ['X-Ray', '12002'],
    ['Staple or Suture Removal', '12001'],
    ['Nasal Lavage (schnozzle)', '30901'],
    ['Oral Rehydration / Medication Administration (including challenge doses)', '96365'],
  ])('out-of-scope type %s is not dragged into a family by a selected %s', (procedureType, code) => {
    expect(detectProcedureFamily({ procedureType, cptCodes: [{ code, display: 'mis-selected' }] })).toBeUndefined();
  });
});

describe('unknown family results', () => {
  it('suggestCode returns an empty, honest result with selected codes not assessed', () => {
    const result = suggestCode({ procedureType: 'X-Ray', cptCodes: [{ code: '73630', display: 'X-ray foot' }] });
    expect(result.family).toEqual({ kind: EvaluationFamilyMatchKind.Unmatched });
    expect(suggestionOf(result)).toBeUndefined();
    expect(result.findings).toHaveLength(0);
    expect(isNotAssessed(result)).toBe(true);
    expect(notAssessedCodes(result)).toEqual(['73630']);
  });

  it('defendCodes mirrors the same not-assessed behavior for a no-code type', () => {
    const result = defendCodes({
      procedureType: 'Nasal Lavage (schnozzle)',
      cptCodes: [{ code: '99213', display: 'Office visit' }],
    });
    expect(result.family).toEqual({ kind: EvaluationFamilyMatchKind.Unmatched });
    expect(notAssessedCodes(result)).toEqual(['99213']);
    expect(supportedCodes(result)).toHaveLength(0);
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
    expect(result.family).toEqual({ kind: EvaluationFamilyMatchKind.Matched, id: 'laceration' });
    expect(result.rulesVintage).toBe(CPT_RULES_VINTAGE);
    expect(suggestionOf(result)?.code).toBe('12042');
    expect(suggestionOf(result)?.justification).toContain('3.2 cm');
  });

  it('defendCodes supports the matching selected code', () => {
    const result = defendCodes(lacerationInput);
    expect(result.family).toEqual({ kind: EvaluationFamilyMatchKind.Matched, id: 'laceration' });
    expect(supportedCodes(result)).toContain('12042');
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
    expect(supportedCodes(result)).toContain('12042');
    expect(notAssessedCodes(result)).toContain('99213');
  });
});
