import { describe, expect, it } from 'vitest';
import { defendCodes, detectProcedureFamily, suggestCode } from './evaluate';
import { EvaluationFamilyMatchKind } from './model.types';
import { CPT_RULES_VINTAGE } from './provenance';
import { isNotAssessed, notAssessedCodes, suggestionOf, supportedCodes } from './test-support';

describe('family detection', () => {
  it('procedure type wins over a mis-selected code', () => {
    expect(
      detectProcedureFamily({
        procedureType: 'Incision and Drainage (I&D) of Abscess',
        cptCodes: [{ code: '12002', display: 'mis-selected' }],
      })?.id
    ).toBe('incision-drainage');
  });

  it('still falls back to the selected code when no family claims the type', () => {
    expect(detectProcedureFamily({ procedureType: '', cptCodes: [{ code: '10060', display: 'I&D simple' }] })?.id).toBe(
      'incision-drainage'
    );
  });

  it('an explicitly out-of-scope type is not dragged into a family by a selected code', () => {
    expect(
      detectProcedureFamily({
        procedureType: 'X-Ray',
        cptCodes: [{ code: '12002', display: 'mis-selected' }],
      })
    ).toBeUndefined();
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
