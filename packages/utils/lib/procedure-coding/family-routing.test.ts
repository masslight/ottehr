import { describe, expect, it } from 'vitest';
import { detectProcedureFamily, PROCEDURE_FAMILIES } from './evaluate';
import {
  exactProcedureFamilyId,
  normalizeProcedureType,
  NOT_ASSESSED_PROCEDURE_TYPES,
  patternProcedureFamilyIds,
  PROCEDURE_FAMILY_ROUTING,
} from './family-routing';

describe('procedure family routing catalog', () => {
  it('has one routing definition for every registered family', () => {
    expect(Object.keys(PROCEDURE_FAMILY_ROUTING).sort()).toEqual(PROCEDURE_FAMILIES.map((family) => family.id).sort());
  });

  it('does not assign an exact display to more than one family', () => {
    const displays = [
      ...Object.values(PROCEDURE_FAMILY_ROUTING).flatMap((definition) => definition.displays),
      ...NOT_ASSESSED_PROCEDURE_TYPES.displays,
    ];
    const normalized = displays.map(normalizeProcedureType);
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it('resolves every catalog display exactly and has no conflicting regex fallback', () => {
    for (const [familyId, definition] of Object.entries(PROCEDURE_FAMILY_ROUTING)) {
      for (const display of definition.displays) {
        expect(exactProcedureFamilyId(display)).toBe(familyId);
        const patternMatches = patternProcedureFamilyIds(display);
        expect(patternMatches.length).toBeLessThanOrEqual(1);
        if (patternMatches.length === 1) expect(patternMatches[0]).toBe(familyId);
      }
    }
  });

  it('keeps explicitly unassessed displays out of every exact family mapping', () => {
    for (const display of NOT_ASSESSED_PROCEDURE_TYPES.displays) {
      expect(exactProcedureFamilyId(display)).toBeUndefined();
    }
  });

  it('has at most one regex fallback match for every known display', () => {
    const displays = [
      ...Object.values(PROCEDURE_FAMILY_ROUTING).flatMap((definition) => definition.displays),
      ...NOT_ASSESSED_PROCEDURE_TYPES.displays,
    ];
    for (const display of displays) {
      expect(patternProcedureFamilyIds(display).length).toBeLessThanOrEqual(1);
    }
  });
});

describe('known configured procedure labels', () => {
  it.each([
    ['Wound & Soft Tissue: Laceration Repair (Suturing/Stapling)', 'laceration'],
    ['Diagnostic Procedures: EKG', 'ekg'],
    ['PROD: I&D abscess, simple', 'incision-drainage'],
    ['PROD: Burn care, partial thickness', 'burn-treatment'],
    ['Foreign body removal - ear', 'foreign-body'],
  ])('routes %s to %s', (procedureType, familyId) => {
    expect(detectProcedureFamily({ procedureType })?.id).toBe(familyId);
  });

  it.each([
    ['Nerve block injection, single nerve', '64450'],
    ['Burn 1st degree', '16000'],
    ['Burn 3rd degree', '16030'],
    ['PROD: I&D pilonidal cyst', '10060'],
    ['DME: Finger splint', '29130'],
  ])('does not route out-of-scope %s through selected code %s', (procedureType, code) => {
    expect(detectProcedureFamily({ procedureType, cptCodes: [{ code, display: 'selected code' }] })).toBeUndefined();
  });
});
