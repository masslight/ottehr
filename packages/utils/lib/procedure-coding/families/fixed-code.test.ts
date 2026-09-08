import { describe, expect, it } from 'vitest';
import { detectProcedureFamily, PROCEDURE_FAMILIES } from '../evaluate';
import {
  citedText,
  evidenceSource,
  findingCode,
  hasFinding,
  isNotAssessed,
  notAssessedCodes,
  notAssessedReason,
  offeredCandidates,
  suggestionOf,
  supportedCodes,
} from '../test-support';
import {
  FIXED_CODE_FAMILIES,
  IV_CATHETER_BUNDLING_PAYER_NOTE,
  ivCatheterPlacementFamily,
  nailTrephinationFamily,
  nebulizerFamily,
  nursemaidElbowFamily,
} from './fixed-code';
import { incisionDrainageFamily } from './incision-drainage';
import { injectionInfusionFamily } from './injection-infusion';
import { splintingFamily } from './splinting';

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
    {
      family: nursemaidElbowFamily,
      code: '24640',
      descriptor: 'radial head subluxation',
      details: 'Left elbow: hyperpronation maneuver with palpable click; child using the arm normally.',
    },
    {
      family: nailTrephinationFamily,
      code: '11740',
      descriptor: 'Evacuation of subungual hematoma',
      details: 'Left index fingernail trephinated with electrocautery; old blood expressed with relief.',
    },
    {
      family: nebulizerFamily,
      code: '94640',
      descriptor: 'inhalation treatment for acute airway obstruction',
      details: 'Albuterol 2.5 mg nebulized; post-treatment improved air entry.',
    },
    {
      family: ivCatheterPlacementFamily,
      code: '36000',
      descriptor: 'Introduction of needle or intracatheter, vein',
      details: '22 g catheter placed in the left antecubital vein, first attempt; flushes easily.',
    },
  ])('$family.id ⇒ $code, display carrying the CPT descriptor', ({ family, code, descriptor, details }) => {
    const result = family.suggestCode({ procedureType: family.displayName, procedureDetails: details });
    expect(suggestionOf(result)?.code).toBe(code);
    expect(suggestionOf(result)?.display).toContain(code);
    expect(suggestionOf(result)?.display).toContain(descriptor);
    expect(suggestionOf(result)?.justification).toContain(`bills a single code → ${code}`);
    expect(offeredCandidates(result.outcome)).toBeUndefined();
    expect(isNotAssessed(result)).toBe(false);
    expect(result.findings.filter((f) => f.level !== 'bestPractice')).toHaveLength(0);
  });
});

describe('fixed-code requirements are negation-guarded and carry their provenance', () => {
  it('"Parent left the room. Reduction performed." does not support 24640', () => {
    const result = nursemaidElbowFamily.defendCodes({
      procedureType: 'Reduction of Nursemaid’s Elbow',
      patientResponse: 'Tolerated Well',
      cptCodes: [{ code: '24640', display: 'Nursemaid elbow reduction' }],
      procedureDetails: 'Parent left the room. Reduction performed.',
    });
    expect(hasFinding(result.findings, 'required', 'Laterality is not documented', '24640')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'reduction maneuver is not documented', '24640')).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('a side bound to the body part satisfies laterality; the structured field still wins', () => {
    const bound = nursemaidElbowFamily.defendCodes({
      procedureType: 'Reduction of Nursemaid’s Elbow',
      patientResponse: 'Tolerated Well',
      cptCodes: [{ code: '24640', display: 'Nursemaid elbow reduction' }],
      procedureDetails: 'Right elbow reduced by hyperpronation with a palpable click.',
    });
    expect(hasFinding(bound.findings, 'required', 'Laterality is not documented', '24640')).toBe(false);
    expect(supportedCodes(bound)).toEqual(['24640']);
  });

  it('negated element language does not satisfy a requirement', () => {
    const result = nailTrephinationFamily.defendCodes({
      procedureType: 'Nail Trephination (Subungual Hematoma Drainage)',
      cptCodes: [{ code: '11740', display: 'Evacuation of subungual hematoma' }],
      procedureDetails: 'No trephination was performed today; nail observed.',
    });
    expect(hasFinding(result.findings, 'required', 'trephination method is not documented', '11740')).toBe(true);
  });

  it('every text-derived finding cites the snippet it was read from', () => {
    const result = nailTrephinationFamily.defendCodes({
      procedureType: 'Nail Trephination (Subungual Hematoma Drainage)',
      cptCodes: [{ code: '11740', display: 'Evacuation of subungual hematoma' }],
      procedureDetails: 'Two fingernails trephinated with electrocautery; old blood expressed from each with relief.',
    });
    const note = result.findings.find((f) => f.message.includes('per nail'));
    expect(citedText(note)).toContain('fingernails');
    expect(evidenceSource(note)).toBe('text');
  });
});

describe('fixed-code honest notes: units, repeats, and bundling are stated rather than flattened', () => {
  it('11740 is per nail — a multi-nail note says so without contradicting the code', () => {
    const result = nailTrephinationFamily.suggestCode({
      procedureType: 'Nail Trephination (Subungual Hematoma Drainage)',
      procedureDetails: 'Two fingernails trephinated with electrocautery; old blood expressed from each.',
    });
    expect(suggestionOf(result)?.code).toBe('11740');
    expect(hasFinding(result.findings, 'bestPractice', 'reported per nail')).toBe(true);
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });

  it('back-to-back nebulizers are reported, not silently flattened to a single 94640', () => {
    const result = nebulizerFamily.defendCodes({
      procedureType: 'Nebulizer Treatment (e.g., Albuterol)',
      patientResponse: 'Tolerated Well',
      cptCodes: [{ code: '94640', display: 'Inhalation treatment' }],
      procedureDetails: 'Three albuterol nebs over 90 minutes; improved air entry after the third.',
    });
    const note = result.findings.find((f) => f.level === 'bestPractice' && findingCode(f) === '94640');
    expect(note?.message).toContain('once per encounter');
    expect(note?.message).toContain('modifier 76');
    expect(citedText(note)).toBeDefined();
    // A [B] must not turn a well-documented code unsupported — the level-based gate, not a count.
    expect(supportedCodes(result)).toEqual(['94640']);
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });

  it('continuous inhalation treatment is not assessed, naming 94644/94645', () => {
    const suggestion = nebulizerFamily.suggestCode({
      procedureType: 'Nebulizer Treatment (e.g., Albuterol)',
      procedureDetails: 'Continuous albuterol nebulization run for two hours with cardiac monitoring.',
    });
    expect(suggestionOf(suggestion)).toBeUndefined();
    expect(isNotAssessed(suggestion)).toBe(true);
    expect(notAssessedReason(suggestion)).toContain('94644');
    expect(notAssessedReason(suggestion)).toContain('94645');

    const defense = nebulizerFamily.defendCodes({
      procedureType: 'Nebulizer Treatment (e.g., Albuterol)',
      cptCodes: [{ code: '94640', display: 'Inhalation treatment' }],
      procedureDetails: 'Continuous albuterol nebulization run for two hours with cardiac monitoring.',
    });
    expect(notAssessedCodes(defense)).toEqual(['94640']);
    expect(supportedCodes(defense)).toHaveLength(0);
    expect(defense.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });

  it('a single treatment gets neither note', () => {
    const result = nebulizerFamily.suggestCode({
      procedureType: 'Nebulizer Treatment (e.g., Albuterol)',
      procedureDetails: 'Albuterol 2.5 mg nebulized once; post-treatment improved air entry.',
    });
    expect(suggestionOf(result)?.code).toBe('94640');
    expect(result.findings).toHaveLength(0);
  });

  it('nebulized normal saline alone does not satisfy the medication requirement', () => {
    const result = nebulizerFamily.defendCodes({
      procedureType: 'Nebulizer Treatment (e.g., Albuterol)',
      patientResponse: 'Tolerated Well',
      cptCodes: [{ code: '94640', display: 'Inhalation treatment' }],
      procedureDetails: 'Saline flush of the IV line beforehand; nebulizer given.',
    });
    expect(hasFinding(result.findings, 'required', 'medication is not documented', '94640')).toBe(true);
  });

  it('hypertonic saline is a real inhalation treatment and does satisfy it', () => {
    const result = nebulizerFamily.defendCodes({
      procedureType: 'Nebulizer Treatment (e.g., Albuterol)',
      patientResponse: 'Tolerated Well',
      cptCodes: [{ code: '94640', display: 'Inhalation treatment' }],
      procedureDetails: '3% saline nebulized for bronchiolitis; post-treatment improved air entry.',
    });
    expect(hasFinding(result.findings, 'required', 'medication is not documented', '94640')).toBe(false);
  });

  it('"no wheezing after the treatment" still documents the response', () => {
    const result = nebulizerFamily.defendCodes({
      procedureType: 'Nebulizer Treatment (e.g., Albuterol)',
      medicationUsed: 'Albuterol 2.5 mg',
      cptCodes: [{ code: '94640', display: 'Inhalation treatment' }],
      procedureDetails: 'Re-examined after the treatment: no wheezing.',
    });
    expect(hasFinding(result.findings, 'required', 'post-treatment response is not documented', '94640')).toBe(false);
  });

  it('36000 carries the NCCI bundling footnote in both directions', () => {
    const ivInput = {
      procedureType: 'Intravenous (IV) Catheter Placement',
      procedureDetails: '22 g catheter placed in the left antecubital vein, first attempt; flushes easily, secured.',
    };
    expect(ivCatheterPlacementFamily.suggestCode(ivInput).payerNotes).toEqual([IV_CATHETER_BUNDLING_PAYER_NOTE]);
    const defense = ivCatheterPlacementFamily.defendCodes({
      ...ivInput,
      cptCodes: [{ code: '36000', display: 'Introduction of needle or intracatheter, vein' }],
    });
    expect(defense.payerNotes).toEqual([IV_CATHETER_BUNDLING_PAYER_NOTE]);
    expect(IV_CATHETER_BUNDLING_PAYER_NOTE).toContain('96360-96379');
    expect(supportedCodes(defense)).toEqual(['36000']);
  });

  it('the other fixed codes carry no payer footnote', () => {
    for (const family of [nursemaidElbowFamily, nailTrephinationFamily, nebulizerFamily]) {
      expect(family.suggestCode({ procedureType: family.displayName }).payerNotes).toEqual([]);
    }
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
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('fully documented nursemaid elbow supports 24640 (structured Side of body + Patient response count)', () => {
    const result = nursemaidElbowFamily.defendCodes({
      procedureType: 'Reduction of Nursemaid’s Elbow',
      bodySide: 'Left',
      patientResponse: 'Tolerated Well',
      cptCodes: [{ code: '24640', display: 'Nursemaid elbow reduction' }],
      procedureDetails: 'Hyperpronation maneuver performed with palpable click.',
    });
    expect(supportedCodes(result)).toEqual(['24640']);
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
    expect(supportedCodes(complete)).toEqual(['11740']);
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
    expect(supportedCodes(complete)).toEqual(['94640']);
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
    expect(supportedCodes(complete)).toEqual(['36000']);
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
    expect(supportedCodes(result)).toEqual(['24640']);
    expect(notAssessedCodes(result)).toEqual(['24600', '99213']);
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });

  it('a selection without the fixed code is entirely not assessed — no invented findings', () => {
    const result = nebulizerFamily.defendCodes({
      procedureType: 'Nebulizer Treatment (e.g., Albuterol)',
      cptCodes: [{ code: '94664', display: 'Demonstration of nebulizer use' }],
    });
    expect(notAssessedCodes(result)).toEqual(['94664']);
    expect(result.findings).toHaveLength(0);
    expect(supportedCodes(result)).toHaveLength(0);
  });
});

describe('fixed-code family metadata', () => {
  // The property that matters is not the order of the literal but the promise it encodes: every
  // fixed family is registered in the engine, after every full family, and each one owns exactly the
  // single code it suggests.
  it('every fixed family is registered after all the full families', () => {
    const registeredIds = PROCEDURE_FAMILIES.map((f) => f.id);
    const fixedIds = FIXED_CODE_FAMILIES.map((f) => f.id);
    expect(fixedIds.every((id) => registeredIds.includes(id))).toBe(true);
    const firstFixedIndex = Math.min(...fixedIds.map((id) => registeredIds.indexOf(id)));
    const lastFullIndex = registeredIds.reduce((last, id, index) => (fixedIds.includes(id) ? last : index), -1);
    expect(firstFixedIndex).toBeGreaterThan(lastFullIndex);
  });

  it('each fixed family suggests, and detects, exactly the one code it owns', () => {
    for (const family of FIXED_CODE_FAMILIES) {
      const code = suggestionOf(family.suggestCode({ procedureType: family.displayName }))?.code;
      expect(code).toBeDefined();
      expect(family.detectBySelectedCode({ cptCodes: [{ code: code as string, display: 'Fixed code' }] })).toBe(true);
      expect(detectProcedureFamily({ cptCodes: [{ code: code as string, display: 'Fixed code' }] })?.id).toBe(
        family.id
      );
    }
  });

  it('none of the fixed families uses the structured length/depth/time inputs', () => {
    for (const family of FIXED_CODE_FAMILIES) {
      expect(family.structuredFieldsFor({})).toEqual([]);
    }
  });
});
