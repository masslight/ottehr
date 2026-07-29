import { describe, expect, it } from 'vitest';
import { extractLacerationFacts, normalizeAnatomicSite } from './extract';
import { ProcedureFactsInput } from './model.types';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Laceration Repair (Suturing/Stapling)', ...overrides };
}

// The §6.1 quick-pick template, filled in realistically.
const TEMPLATE_TEXT = [
  'Laceration Repair',
  'Anatomical Location: Left forearm',
  'Wound Length: 3.2 cm',
  'Repair Depth: Superficial, single layer',
  'Anesthesia: 1% lidocaine with epinephrine, 3 mL local infiltration',
  'Irrigation: copious normal saline irrigation',
  'Closure: Simple Interrupted, 4-0 Ethilon',
  'Total stitch count: 5',
  'Tetanus status: Up to date',
].join('\n');

const FREEHAND_TEXT =
  'Left volar mid-forearm 4 cm linear laceration anesthetized with 1% lidocaine. ' +
  'Wound irrigated with sterile saline; no foreign body identified. ' +
  'Closed with 4 simple interrupted 5-0 nylon sutures. ' +
  'Bacitracin and dry sterile dressing applied. Patient tolerated well.';

const GARBAGE_TEXT = 'Patient counseled on wound care. Follow up in 10 days. Return precautions discussed.';

describe('normalizeAnatomicSite', () => {
  it.each([
    ['Arm', 'extremity'],
    ['Face', 'face'],
    ['Head', 'scalp'],
    ['Torso', 'trunk'],
    ['Genital', 'genitalia'],
    ['left hand', 'hand'],
    ['Foot', 'foot'],
    ['forearm', 'extremity'],
    ['left cheek', 'face'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeAnatomicSite(raw)).toBe(expected);
  });

  it('returns undefined for unrecognized sites rather than guessing', () => {
    expect(normalizeAnatomicSite('Eye')).toBeUndefined();
    expect(normalizeAnatomicSite('widget')).toBeUndefined();
    expect(normalizeAnatomicSite(undefined)).toBeUndefined();
  });
});

describe('extractLacerationFacts: template-shaped text', () => {
  const facts = extractLacerationFacts(input({ procedureDetails: TEMPLATE_TEXT }));

  it('reads the wound length with a sourceText citation', () => {
    expect(facts.wounds).toHaveLength(1);
    expect(facts.wounds[0].lengthCm).toBe(3.2);
    expect(facts.wounds[0].confidence).toBe('text');
    expect(facts.wounds[0].sourceText).toContain('3.2 cm');
  });

  it('reads the site from text when no structured body site is set', () => {
    expect(facts.site?.value).toBe('extremity');
    expect(facts.site?.confidence).toBe('text');
    expect(facts.site?.sourceText).toContain('forearm');
  });

  it('reads depth from explicit layer language only', () => {
    expect(facts.depth?.value).toBe('single-layer');
    expect(facts.depth?.sourceText).toBeDefined();
  });

  it('reads closure method, material, and count', () => {
    expect(facts.closureMethod?.value).toBe('simple interrupted');
    expect(facts.closureMaterial?.value.toLowerCase()).toContain('ethilon');
    expect(facts.closureCount?.value).toBe(5);
    expect(facts.closureCount?.sourceText).toContain('5');
  });

  it('reads anesthesia, irrigation, and tetanus', () => {
    expect(facts.anesthesiaDocumented?.value).toBe(true);
    expect(facts.irrigationDocumented?.value).toBe(true);
    expect(facts.tetanusDocumented?.value).toBe(true);
  });

  it('does not treat copious irrigation as the contamination-path cleaning without contamination language', () => {
    expect(facts.contaminationDocumented).toBeUndefined();
    expect(facts.extensiveCleaningDocumented).toBeUndefined();
  });
});

describe('extractLacerationFacts: freehand text', () => {
  const facts = extractLacerationFacts(input({ procedureDetails: FREEHAND_TEXT }));

  it('reads a single wound length once even though the wound is mentioned repeatedly', () => {
    expect(facts.wounds).toHaveLength(1);
    expect(facts.wounds[0].lengthCm).toBe(4);
  });

  it('reads closure details from prose', () => {
    expect(facts.closureMethod?.value).toBe('simple interrupted');
    expect(facts.closureMaterial?.value.toLowerCase()).toContain('nylon');
    expect(facts.closureCount?.value).toBe(4);
  });

  it('does not infer depth without explicit layer language', () => {
    expect(facts.depth).toBeUndefined();
  });

  it('reads site, anesthesia, and irrigation with citations', () => {
    expect(facts.site?.value).toBe('extremity');
    expect(facts.anesthesiaDocumented?.sourceText).toContain('lidocaine');
    expect(facts.irrigationDocumented?.value).toBe(true);
  });
});

describe('extractLacerationFacts: garbage text yields honest unknowns', () => {
  const facts = extractLacerationFacts(input({ procedureDetails: GARBAGE_TEXT }));

  it('finds no wounds, depth, or closure details', () => {
    expect(facts.wounds).toHaveLength(0);
    expect(facts.depth).toBeUndefined();
    expect(facts.closureMethod).toBeUndefined();
    expect(facts.closureMaterial).toBeUndefined();
    expect(facts.closureCount).toBeUndefined();
    expect(facts.suturesDocumented).toBeUndefined();
  });
});

describe('extractLacerationFacts: numeric and pattern edge cases', () => {
  it('accepts 3.2cm, 3.2 cm, and comma decimals', () => {
    expect(extractLacerationFacts(input({ procedureDetails: 'A 3.2cm laceration.' })).wounds[0].lengthCm).toBe(3.2);
    expect(extractLacerationFacts(input({ procedureDetails: 'A 3.2 cm laceration.' })).wounds[0].lengthCm).toBe(3.2);
    expect(extractLacerationFacts(input({ procedureDetails: 'A 3,2 cm laceration.' })).wounds[0].lengthCm).toBe(3.2);
  });

  it('reads a Wound Length line without a cm unit', () => {
    const facts = extractLacerationFacts(input({ procedureDetails: 'Wound Length: 2.8\nClosed with sutures.' }));
    expect(facts.wounds[0].lengthCm).toBe(2.8);
  });

  it('ignores cm figures that are distances, not wound lengths', () => {
    const facts = extractLacerationFacts(
      input({ procedureDetails: 'Wound located 2 cm from the elbow, measuring 3.0 cm in length.' })
    );
    expect(facts.wounds).toHaveLength(1);
    expect(facts.wounds[0].lengthCm).toBe(3.0);
  });

  it('keeps multiple wounds when the text signals separate wounds', () => {
    const facts = extractLacerationFacts(
      input({ procedureDetails: 'Two lacerations of the scalp: 2.0 cm and 2.0 cm, both closed with staples.' })
    );
    expect(facts.wounds).toHaveLength(2);
  });

  it('does not read suture sizes (4-0, 5-0) as counts', () => {
    const facts = extractLacerationFacts(input({ procedureDetails: 'Closed with 4-0 nylon sutures.' }));
    expect(facts.closureCount).toBeUndefined();
  });

  it('subcuticular is a closure method, never depth proof', () => {
    const facts = extractLacerationFacts(input({ procedureDetails: 'Closed with running subcuticular 5-0 Monocryl.' }));
    expect(facts.closureMethod?.value).toBe('subcuticular');
    expect(facts.depth).toBeUndefined();
  });
});

describe('extractLacerationFacts: closure-evidence and negation', () => {
  it('detects strips with negated sutures/staples (strips-only shape)', () => {
    const facts = extractLacerationFacts(
      input({ procedureDetails: 'Wound edges approximated with steri-strips only; no sutures or staples required.' })
    );
    expect(facts.adhesiveStripsDocumented?.value).toBe(true);
    expect(facts.suturesDocumented).toBeUndefined();
    expect(facts.staplesDocumented).toBeUndefined();
  });

  it('detects tissue adhesive distinctly from strips', () => {
    const facts = extractLacerationFacts(input({ procedureDetails: 'Wound closed with Dermabond tissue adhesive.' }));
    expect(facts.tissueAdhesiveDocumented?.value).toBe(true);
    expect(facts.adhesiveStripsDocumented).toBeUndefined();
  });

  it('takes contamination + extensive cleaning together, with citations', () => {
    const facts = extractLacerationFacts(
      input({ procedureDetails: 'Heavily contaminated wound, extensively cleaned and irrigated before closure.' })
    );
    expect(facts.contaminationDocumented?.sourceText).toContain('contaminated');
    expect(facts.extensiveCleaningDocumented?.value).toBe(true);
  });

  it('prefers structured fields: body site, medication, supplies', () => {
    const facts = extractLacerationFacts(
      input({
        bodySite: 'Arm',
        medicationUsed: '1% lidocaine',
        suppliesUsed: ['Suture Kit'],
        procedureDetails: 'Closed without complications.',
      })
    );
    expect(facts.site?.value).toBe('extremity');
    expect(facts.site?.confidence).toBe('structured');
    expect(facts.anesthesiaDocumented?.confidence).toBe('structured');
    expect(facts.suturesDocumented?.confidence).toBe('structured');
  });

  it('prefers the structured length field over text lengths', () => {
    const facts = extractLacerationFacts(input({ lengthCm: 3.2, procedureDetails: 'Wound Length: 8 cm.' }));
    expect(facts.structuredLengthCm).toBe(3.2);
    expect(facts.wounds[0].lengthCm).toBe(8);
  });
});

describe('extractLacerationFacts: complex-repair qualifying elements', () => {
  it.each([
    ['extensive-undermining', 'Extensive undermining performed around the wound.'],
    ['extensive-undermining', 'Wound edges undermined extensively.'],
    ['retention-sutures', 'Retention sutures placed given wound tension.'],
    ['stents', 'Stent placed to support the repair.'],
    ['debridement', 'Devitalized wound edges debrided.'],
    ['exposed-structure', 'Bone exposed at the base of the wound.'],
    ['exposed-structure', 'Exploration revealed exposed tendon.'],
    ['free-margin', 'Laceration crosses the vermilion border of the lip.'],
    ['free-margin', 'Wound involves the helical rim.'],
  ])('reads %s from "%s" with a sourceText citation', (element, text) => {
    const facts = extractLacerationFacts(input({ procedureDetails: text }));
    expect(facts.complexElements.map((e) => e.value)).toContain(element);
    expect(facts.complexElements[0].sourceText).toBeDefined();
  });

  it('plain undermining is NOT extensive undermining (CPT requires the extent to be documented)', () => {
    const facts = extractLacerationFacts(input({ procedureDetails: 'Wound edges gently undermined before closure.' }));
    expect(facts.complexElements).toHaveLength(0);
  });

  it('negated elements are not read', () => {
    const facts = extractLacerationFacts(input({ procedureDetails: 'No debridement required.' }));
    expect(facts.complexElements).toHaveLength(0);
  });

  it('debridement/undermining no longer trip the outside-scope flag; tissue rearrangement still does', () => {
    expect(
      extractLacerationFacts(input({ procedureDetails: 'Wound edges debrided and extensively undermined.' }))
        .outsideScope
    ).toBeUndefined();
    expect(
      extractLacerationFacts(input({ procedureDetails: 'Z-plasty performed for closure.' })).outsideScope?.value
    ).toBe(true);
    expect(
      extractLacerationFacts(input({ procedureDetails: 'Rotation flap raised and inset.' })).outsideScope?.value
    ).toBe(true);
  });
});
