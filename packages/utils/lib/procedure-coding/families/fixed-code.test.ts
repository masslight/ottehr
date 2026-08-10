import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { Finding } from '../model.types';
import {
  FIXED_CODE_FAMILIES,
  ivCatheterPlacementFamily,
  nailTrephinationFamily,
  nebulizerFamily,
  nursemaidElbowFamily,
} from './fixed-code';
import { incisionDrainageFamily } from './incision-drainage';
import { injectionInfusionFamily } from './injection-infusion';
import { splintingFamily } from './splinting';

function hasFinding(
  findings: Finding[],
  level: Finding['level'],
  messagePart: string | RegExp,
  cptCode?: string
): boolean {
  return findings.some(
    (f) =>
      f.level === level &&
      (typeof messagePart === 'string' ? f.message.includes(messagePart) : messagePart.test(f.message)) &&
      (cptCode === undefined || f.cptCode === cptCode)
  );
}

describe('fixed-code detection: the product types and slugs, plus the code alone', () => {
  it.each([
    ['Reduction of Nursemaid’s Elbow', 'nursemaid-elbow'],
    ['elbow-reduction', 'nursemaid-elbow'],
    ['Nail Trephination (Subungual Hematoma Drainage)', 'nail-trephination'],
    ['nail-trephination', 'nail-trephination'],
    ['Nebulizer Treatment (e.g., Albuterol)', 'nebulizer'],
    ['nebulizer-treatment', 'nebulizer'],
    ['Intravenous (IV) Catheter Placement', 'iv-catheter-placement'],
    ['iv-catheter-placement', 'iv-catheter-placement'],
  ])('%s ⇒ %s', (procedureType, expectedFamily) => {
    expect(detectProcedureFamily({ procedureType })?.id).toBe(expectedFamily);
  });

  it('detects the 94640 CPT descriptor type shape (the long inhalation-treatment display)', () => {
    expect(
      detectProcedureFamily({
        procedureType:
          'Pressurized or nonpressurized inhalation treatment for acute airway obstruction for therapeutic purposes and/or for diagnostic purposes such as sputum induction with an aerosol generator, nebulizer, metered dose inhaler or intermittent positive pressure breathing (IPPB) device',
      })?.id
    ).toBe('nebulizer');
  });

  it.each([
    ['24640', 'nursemaid-elbow'],
    ['11740', 'nail-trephination'],
    ['94640', 'nebulizer'],
    ['36000', 'iv-catheter-placement'],
  ])('detects from the selected %s alone', (code, expectedFamily) => {
    expect(detectProcedureFamily({ cptCodes: [{ code, display: 'Fixed code' }] })?.id).toBe(expectedFamily);
  });
});

describe('fixed-code detection never shadows the full families (registered last)', () => {
  it('a full-family type stays with its full family even when a fixed code is also selected', () => {
    expect(
      detectProcedureFamily({
        procedureType: 'Urinary Catheterization',
        cptCodes: [{ code: '94640', display: 'Neb' }],
      })?.id
    ).toBe('urinary-catheterization');
  });

  it('the fixed types are not claimed by adjacent full families', () => {
    expect(injectionInfusionFamily.detect({ procedureType: 'Intravenous (IV) Catheter Placement' })).toBe(false);
    expect(injectionInfusionFamily.detect({ procedureType: 'Nebulizer Treatment (e.g., Albuterol)' })).toBe(false);
    expect(splintingFamily.detect({ procedureType: 'Reduction of Nursemaid’s Elbow' })).toBe(false);
    expect(incisionDrainageFamily.detect({ procedureType: 'Nail Trephination (Subungual Hematoma Drainage)' })).toBe(
      false
    );
  });

  it('the fixed families do not claim each other or unrelated types', () => {
    expect(nursemaidElbowFamily.detect({ procedureType: 'Nail Trephination (Subungual Hematoma Drainage)' })).toBe(
      false
    );
    expect(nebulizerFamily.detect({ procedureType: 'Intravenous (IV) Catheter Placement' })).toBe(false);
    expect(ivCatheterPlacementFamily.detect({ procedureType: 'IV Fluid Administration' })).toBe(false);
    expect(nailTrephinationFamily.detect({ procedureType: 'Incision and Drainage (I&D) of Abscess' })).toBe(false);
  });
});

describe('fixed-code forward: the type itself determines its single code', () => {
  it.each([
    [nursemaidElbowFamily, '24640'],
    [nailTrephinationFamily, '11740'],
    [nebulizerFamily, '94640'],
    [ivCatheterPlacementFamily, '36000'],
  ])('suggests the fixed code with the single-code justification', (family, code) => {
    const result = family.suggestCode({ procedureType: family.displayName });
    expect(result.suggestion?.code).toBe(code);
    expect(result.suggestion?.justification).toContain(`bills a single code → ${code}`);
    expect(result.openCandidates).toBeUndefined();
    expect(result.findings).toHaveLength(0);
  });
});

describe('fixed-code inverse: minimal [R] asks per type', () => {
  it('nursemaid elbow with nothing documented ⇒ the three [R] basics', () => {
    const result = nursemaidElbowFamily.defendCodes({
      procedureType: 'Reduction of Nursemaid’s Elbow',
      cptCodes: [{ code: '24640', display: 'Nursemaid elbow reduction' }],
    });
    expect(hasFinding(result.findings, 'required', 'Laterality is not documented', '24640')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'reduction maneuver is not documented', '24640')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'outcome is not documented', '24640')).toBe(true);
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('fully documented nursemaid elbow supports 24640 (structured Side of body + Patient response count)', () => {
    const result = nursemaidElbowFamily.defendCodes({
      procedureType: 'Reduction of Nursemaid’s Elbow',
      bodySide: 'Left',
      patientResponse: 'Tolerated Well',
      cptCodes: [{ code: '24640', display: 'Nursemaid elbow reduction' }],
      procedureDetails: 'Hyperpronation maneuver performed with palpable click.',
    });
    expect(result.supportedCodes).toEqual(['24640']);
    expect(result.findings).toHaveLength(0);
  });

  it('nail trephination asks for digit, method, and outcome; a complete note supports 11740', () => {
    const empty = nailTrephinationFamily.defendCodes({
      procedureType: 'Nail Trephination (Subungual Hematoma Drainage)',
      cptCodes: [{ code: '11740', display: 'Evacuation of subungual hematoma' }],
    });
    expect(hasFinding(empty.findings, 'required', 'affected digit is not documented', '11740')).toBe(true);
    expect(hasFinding(empty.findings, 'required', 'trephination method is not documented', '11740')).toBe(true);
    expect(hasFinding(empty.findings, 'required', 'outcome is not documented', '11740')).toBe(true);

    const complete = nailTrephinationFamily.defendCodes({
      procedureType: 'Nail Trephination (Subungual Hematoma Drainage)',
      cptCodes: [{ code: '11740', display: 'Evacuation of subungual hematoma' }],
      procedureDetails:
        'Left index finger nail plate trephinated with electrocautery; old blood expressed with immediate relief.',
    });
    expect(complete.supportedCodes).toEqual(['11740']);
    expect(complete.findings).toHaveLength(0);
  });

  it('nebulizer asks for medication and response; structured fields satisfy both', () => {
    const empty = nebulizerFamily.defendCodes({
      procedureType: 'Nebulizer Treatment (e.g., Albuterol)',
      cptCodes: [{ code: '94640', display: 'Inhalation treatment' }],
    });
    expect(hasFinding(empty.findings, 'required', 'medication is not documented', '94640')).toBe(true);
    expect(hasFinding(empty.findings, 'required', 'post-treatment response is not documented', '94640')).toBe(true);

    const complete = nebulizerFamily.defendCodes({
      procedureType: 'Nebulizer Treatment (e.g., Albuterol)',
      medicationUsed: 'Albuterol 2.5 mg',
      patientResponse: 'Tolerated Well',
      cptCodes: [{ code: '94640', display: 'Inhalation treatment' }],
    });
    expect(complete.supportedCodes).toEqual(['94640']);
    expect(complete.findings).toHaveLength(0);
  });

  it('IV catheter placement asks for site, placement description, and outcome; a complete note supports 36000', () => {
    const empty = ivCatheterPlacementFamily.defendCodes({
      procedureType: 'Intravenous (IV) Catheter Placement',
      cptCodes: [{ code: '36000', display: 'Introduction of needle or intracatheter, vein' }],
    });
    expect(hasFinding(empty.findings, 'required', 'insertion site is not documented', '36000')).toBe(true);
    expect(hasFinding(empty.findings, 'required', 'catheter placement is not described', '36000')).toBe(true);
    expect(hasFinding(empty.findings, 'required', 'outcome is not documented', '36000')).toBe(true);

    const complete = ivCatheterPlacementFamily.defendCodes({
      procedureType: 'Intravenous (IV) Catheter Placement',
      cptCodes: [{ code: '36000', display: 'Introduction of needle or intracatheter, vein' }],
      procedureDetails: '22 g catheter placed in the left antecubital vein, first attempt; flushes easily, secured.',
    });
    expect(complete.supportedCodes).toEqual(['36000']);
    expect(complete.findings).toHaveLength(0);
  });
});

describe('fixed-code inverse: scope honesty — foreign codes are never contradicted', () => {
  it('any other selected code in the family space is listed not assessed', () => {
    const result = nursemaidElbowFamily.defendCodes({
      procedureType: 'Reduction of Nursemaid’s Elbow',
      bodySide: 'Left',
      patientResponse: 'Tolerated Well',
      cptCodes: [
        { code: '24640', display: 'Nursemaid elbow reduction' },
        { code: '24600', display: 'Treatment of closed elbow dislocation' },
        { code: '99213', display: 'Office visit' },
      ],
      procedureDetails: 'Hyperpronation maneuver performed with palpable click.',
    });
    expect(result.supportedCodes).toEqual(['24640']);
    expect(result.notAssessedCodes).toEqual(['24600', '99213']);
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });

  it('a selection without the fixed code is entirely not assessed — no invented findings', () => {
    const result = nebulizerFamily.defendCodes({
      procedureType: 'Nebulizer Treatment (e.g., Albuterol)',
      cptCodes: [{ code: '94664', display: 'Demonstration of nebulizer use' }],
    });
    expect(result.notAssessedCodes).toEqual(['94664']);
    expect(result.findings).toHaveLength(0);
    expect(result.supportedCodes).toHaveLength(0);
  });
});

describe('fixed-code family metadata', () => {
  it('registers exactly the four coded types (the no-code types deliberately have no family)', () => {
    expect(FIXED_CODE_FAMILIES.map((f) => f.id)).toEqual([
      'nursemaid-elbow',
      'nail-trephination',
      'nebulizer',
      'iv-catheter-placement',
    ]);
  });

  it('none of the fixed families uses the structured length/depth/time inputs', () => {
    for (const family of FIXED_CODE_FAMILIES) {
      expect(family.usesStructuredLength).toBeUndefined();
      expect(family.usesStructuredRepairDepth).toBeUndefined();
      expect(family.usesStructuredInfusionTimes).toBeUndefined();
    }
  });
});
