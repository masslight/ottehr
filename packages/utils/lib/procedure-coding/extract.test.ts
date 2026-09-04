import { describe, expect, it } from 'vitest';
import {
  HEMOSTASIS_PATTERN,
  lateralityDocumented,
  MAX_ANALYZED_TEXT_LENGTH,
  normalizeAnatomicSite,
  normalizeNoteText,
  techniqueOrTextFlag,
} from './extract';
import { extractLacerationFacts } from './families/laceration';
import { ProcedureFactsInput } from './model.types';
import { citedText, evidenceSource } from './test-support';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Laceration Repair (Suturing/Stapling)', ...overrides };
}

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
  const read = (): ReturnType<typeof extractLacerationFacts> =>
    extractLacerationFacts(input({ procedureDetails: TEMPLATE_TEXT }));

  it('reads the wound length with a sourceText citation', () => {
    const facts = read();
    expect(facts.wounds).toHaveLength(1);
    expect(facts.wounds[0].lengthCm).toBe(3.2);
    expect(evidenceSource(facts.wounds[0])).toBe('text');
    expect(citedText(facts.wounds[0])).toContain('3.2 cm');
  });

  it('reads the site from the labelled location line when no structured body site is set', () => {
    const facts = read();
    expect(facts.site?.value).toBe('extremity');
    expect(evidenceSource(facts.site)).toBe('text');
    expect(citedText(facts.site)).toContain('forearm');
  });

  it('reads depth from explicit layer language only', () => {
    const facts = read();
    expect(facts.depth?.value).toBe('single-layer');
    expect(citedText(facts.depth)).toBeDefined();
  });

  it('reads closure method, material, and count', () => {
    const facts = read();
    expect(facts.closureMethod?.value).toBe('simple interrupted');
    expect(facts.closureMaterial?.value.toLowerCase()).toContain('ethilon');
    expect(facts.closureCount?.value).toBe(5);
    expect(citedText(facts.closureCount)).toContain('stitch count');
  });

  it('reads anesthesia, irrigation, and tetanus', () => {
    const facts = read();
    expect(facts.anesthesiaDocumented?.value).toBe(true);
    expect(facts.irrigationDocumented?.value).toBe(true);
    expect(facts.tetanusDocumented?.value).toBe(true);
  });

  it('does not read "copious normal saline irrigation" as the extensive-cleaning element', () => {
    const facts = read();
    expect(facts.contaminationDocumented).toBeUndefined();
    expect(facts.extensiveCleaningDocumented).toBeUndefined();
  });
});

describe('extractLacerationFacts: freehand text', () => {
  const read = (): ReturnType<typeof extractLacerationFacts> =>
    extractLacerationFacts(input({ procedureDetails: FREEHAND_TEXT }));

  it('reads a single wound length once even though the wound is mentioned repeatedly', () => {
    const facts = read();
    expect(facts.wounds).toHaveLength(1);
    expect(facts.wounds[0].lengthCm).toBe(4);
  });

  it('reads closure details from prose', () => {
    const facts = read();
    expect(facts.closureMethod?.value).toBe('simple interrupted');
    expect(facts.closureMaterial?.value.toLowerCase()).toContain('nylon');
    expect(facts.closureCount?.value).toBe(4);
  });

  it('does not infer depth without explicit layer language', () => {
    expect(read().depth).toBeUndefined();
  });

  it('reads site, anesthesia, and irrigation with citations', () => {
    const facts = read();
    expect(facts.site?.value).toBe('extremity');
    expect(citedText(facts.anesthesiaDocumented)).toContain('lidocaine');
    expect(facts.irrigationDocumented?.value).toBe(true);
  });
});

describe('extractLacerationFacts: garbage text yields honest unknowns', () => {
  const read = (): ReturnType<typeof extractLacerationFacts> =>
    extractLacerationFacts(input({ procedureDetails: GARBAGE_TEXT }));

  it('finds no wounds, depth, or closure details', () => {
    const facts = read();
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

  it('reads the count-x-gauge shorthand "5 x 4-0 nylon, simple interrupted" fully (count + material + method)', () => {
    const facts = extractLacerationFacts(input({ procedureDetails: '5 x 4-0 nylon, simple interrupted' }));
    expect(facts.closureCount?.value).toBe(5);
    expect(facts.closureMaterial?.value.toLowerCase()).toContain('nylon');
    expect(facts.closureMethod?.value).toBe('simple interrupted');
  });

  it('accepts count-x-gauge spacing/case variants but never wound dimensions', () => {
    expect(extractLacerationFacts(input({ procedureDetails: 'Closed with 5x 4-0 prolene.' })).closureCount?.value).toBe(
      5
    );
    expect(extractLacerationFacts(input({ procedureDetails: 'Closed with 5 X 4.0 nylon.' })).closureCount?.value).toBe(
      5
    );
    expect(
      extractLacerationFacts(input({ procedureDetails: 'Abrasion measuring 2 x 4.0 cm.' })).closureCount
    ).toBeUndefined();
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
    expect(citedText(facts.contaminationDocumented)).toContain('contaminated');
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
    expect(evidenceSource(facts.site)).toBe('field');
    expect(evidenceSource(facts.anesthesiaDocumented)).toBe('field');
    expect(evidenceSource(facts.suturesDocumented)).toBe('field');
  });

  it('prefers the structured length field over text lengths', () => {
    const facts = extractLacerationFacts(input({ lengthCm: 3.2, procedureDetails: 'Wound Length: 8 cm.' }));
    expect(facts.structuredLengthCm).toBe(3.2);
    expect(facts.wounds[0].lengthCm).toBe(8);
  });
});

describe('extractLacerationFacts: freehand abbreviation lexicon', () => {
  it('reads "lido" as anesthesia with a citation', () => {
    const facts = extractLacerationFacts(input({ procedureDetails: 'Wound infiltrated with 2 mL 1% lido.' }));
    expect(facts.anesthesiaDocumented?.value).toBe(true);
    expect(citedText(facts.anesthesiaDocumented)).toContain('lido');
  });

  it('negated "lido" is not read as anesthesia', () => {
    const facts = extractLacerationFacts(input({ procedureDetails: 'No lido required for closure.' }));
    expect(facts.anesthesiaDocumented).toBeUndefined();
  });

  it('reads closure details through "w/" shorthand', () => {
    const facts = extractLacerationFacts(
      input({ procedureDetails: 'Closed w/ 5 simple interrupted 4-0 nylon sutures.' })
    );
    expect(facts.closureCount?.value).toBe(5);
    expect(facts.closureMaterial?.value.toLowerCase()).toContain('nylon');
    expect(facts.closureMethod?.value).toBe('simple interrupted');
  });

  it('"w/o" negates like "without" and never counts as positive evidence', () => {
    const facts = extractLacerationFacts(
      input({ procedureDetails: 'Wound edges approximated with steri-strips, w/o sutures or staples.' })
    );
    expect(facts.suturesDocumented).toBeUndefined();
    expect(facts.staplesDocumented).toBeUndefined();
    expect(facts.adhesiveStripsDocumented?.value).toBe(true);
  });

  it.each([
    ['4.0 nylon', 'nylon'],
    ['4/0 prolene', 'prolene'],
    ['4-0 vicryl', 'vicryl'],
  ])('reads the sized material from the gauge variant "%s"', (phrase, material) => {
    const facts = extractLacerationFacts(input({ procedureDetails: `Closed with ${phrase} sutures.` }));
    expect(facts.closureMaterial?.value.toLowerCase()).toContain(material);
  });
});

describe('extractLacerationFacts: implicit layered closure (two distinct suture layers)', () => {
  it.each([
    ['deep dermal then skin', '3 deep dermal 4-0 Vicryl, skin closed with 5-0 nylon.'],
    ['material-first shorthand', 'Vicryl deep, nylon to skin.'],
    ['named subcutaneous layer', 'Subcutaneous layer closed with 3-0 Vicryl; skin re-approximated with 5-0 nylon.'],
  ])('infers layered from %s with a citation', (_label, text) => {
    const facts = extractLacerationFacts(input({ procedureDetails: text }));
    expect(facts.depth?.value).toBe('layered');
    expect(evidenceSource(facts.depth)).toBe('text');
    expect(citedText(facts.depth)).toBeDefined();
  });

  it.each([
    ['a plain single-layer note', 'Closed with simple interrupted sutures placed.'],
    ['a deep wound with one closure layer', 'Deep laceration of the forearm. Skin closed with 5-0 nylon.'],
    ['one ambiguous pass through both layers', 'Subcutaneous tissue and skin closed with nylon.'],
    ['a skin-only closure', 'Skin closed with running 5-0 nylon.'],
  ])('does not infer layered from %s', (_label, text) => {
    const facts = extractLacerationFacts(input({ procedureDetails: text }));
    expect(facts.depth).toBeUndefined();
  });

  it('negated deep-layer closure does not infer layered', () => {
    const facts = extractLacerationFacts(
      input({ procedureDetails: 'No deep dermal Vicryl needed; skin closed with 5-0 nylon.' })
    );
    expect(facts.depth).toBeUndefined();
  });

  it('explicit single-layer language wins over the two-layer inference', () => {
    const facts = extractLacerationFacts(
      input({ procedureDetails: 'Single-layer closure. Deep dermal 4-0 Vicryl, skin closed with 5-0 nylon.' })
    );
    expect(facts.depth?.value).toBe('single-layer');
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
    expect(citedText(facts.complexElements[0])).toBeDefined();
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

describe('extractLacerationFacts: negation after the match (post-modified negation)', () => {
  it.each([
    ['undermining denied after the fact', 'A 3.2 cm lac. Extensive undermining was NOT performed.'],
    ['stents denied after the fact', 'Stents were not used.'],
    ['debridement deferred', 'Debridement of the wound bed was deferred.'],
  ])('%s yields no complex-repair element', (_label, text) => {
    expect(extractLacerationFacts(input({ procedureDetails: text })).complexElements).toHaveLength(0);
  });

  it('a question answered "No" is not documentation of the element', () => {
    expect(
      extractLacerationFacts(input({ procedureDetails: 'Wound was irrigated? No.' })).irrigationDocumented
    ).toBeUndefined();
  });

  it('post-negation stays inside its clause: "; no sutures" does not negate the strips before it', () => {
    const facts = extractLacerationFacts(
      input({ procedureDetails: 'Wound edges approximated with steri-strips only; no sutures or staples required.' })
    );
    expect(facts.adhesiveStripsDocumented?.value).toBe(true);
    expect(facts.suturesDocumented).toBeUndefined();
  });
});

describe('extractLacerationFacts: complex elements need a performed modality', () => {
  it.each([
    ['planned', 'Will need debridement at follow-up.'],
    ['historical', 'History of debridement last week.'],
    ['a past cardiac stent', 'Coronary stent 2019.'],
    ['a recommendation', 'Recommended debridement if the wound does not granulate.'],
  ])('%s mentions are not documentation that the element was performed', (_label, text) => {
    expect(extractLacerationFacts(input({ procedureDetails: text })).complexElements).toHaveLength(0);
  });

  it.each([
    'Devitalized wound edges debrided.',
    'Extensive undermining performed prior to closure.',
    'Stent placed to support the repair.',
  ])('a performed element is still read: "%s"', (text) => {
    expect(extractLacerationFacts(input({ procedureDetails: text })).complexElements.length).toBeGreaterThan(0);
  });
});

describe('extractLacerationFacts: length parsing edge cases', () => {
  const lengths = (text: string): number[] =>
    extractLacerationFacts(input({ procedureDetails: text })).wounds.map((w) => w.lengthCm);

  it('takes the longer dimension from the "L x W" shorthand (the repaired length is the longer one)', () => {
    expect(lengths('2.5 x 1.0 cm laceration of the forearm')).toEqual([2.5]);
    expect(lengths('Laceration 1.0 cm x 4.5 cm of the forearm')).toEqual([4.5]);
  });

  it('parses mm as a length and converts it to cm', () => {
    expect(lengths('Laceration 12 mm in length')).toEqual([1.2]);
  });

  it('normalizes typographic decimal separators instead of misreading them', () => {
    expect(lengths('Wound 3·5 cm')).toEqual([3.5]);
  });

  it('does not turn a thousands separator into a decimal point', () => {
    // 1,234 cm is a data-entry error, not 1.234 cm — report nothing rather than a wrong band.
    expect(lengths('Wound 1,234 cm')).toEqual([]);
    expect(lengths('A 3,2 cm laceration.')).toEqual([3.2]);
  });

  it('accepts the plural unit "cms"', () => {
    expect(lengths('Wound 3.2cms in length')).toEqual([3.2]);
  });
});

describe('extractLacerationFacts: entry site is chosen by proximity to the wound, not table order', () => {
  it.each<[string, string | undefined]>([
    ['Laceration to the back of the left hand, 3 cm.', 'hand'],
    ['Left knee laceration 3 cm. Ear exam normal.', 'extremity'],
    ['Chest laceration 3 cm; also examined the nose, normal.', 'trunk'],
    ['Patient came back for recheck. 3 cm hand laceration.', 'hand'],
    ['3 cm laceration. Head CT negative.', undefined],
    ['oral intake normal. 3 cm arm laceration closed with sutures.', 'extremity'],
  ])('"%s" resolves to %s', (text, expected) => {
    expect(extractLacerationFacts(input({ procedureDetails: text })).site?.value).toBe(expected);
  });

  it('keeps the structured body site and reports the text site separately for reconciliation', () => {
    const facts = extractLacerationFacts(
      input({ bodySite: 'Left upper eyelid', procedureDetails: '3 cm lac of the trunk' })
    );
    expect(facts.site?.value).toBe('eyelid');
    expect(evidenceSource(facts.site)).toBe('field');
    expect(facts.siteFromText?.value).toBe('trunk');
  });
});

describe('extractLacerationFacts: wound de-duplication', () => {
  it('three mentions of one 3 cm wound stay one wound (never summed to 6 cm)', () => {
    const facts = extractLacerationFacts(
      input({
        procedureDetails: 'A 3.0 cm laceration and 3.0 cm and 3.0 cm on the arm. Single-layer closure with 4-0 nylon.',
      })
    );
    expect(facts.wounds).toHaveLength(1);
    expect(facts.wounds[0].lengthCm).toBe(3.0);
    expect(facts.duplicateLengthMention?.value).toBe(true);
  });

  it('a repeated Wound Length template label is one measurement, not two wounds', () => {
    const facts = extractLacerationFacts(input({ procedureDetails: 'wound length: 3.2 cm and wound length 4.0' }));
    expect(facts.wounds.map((w) => w.lengthCm)).toEqual([3.2]);
  });

  it('bilateral wounds of equal length stay distinct', () => {
    const facts = extractLacerationFacts(
      input({ procedureDetails: 'Wound 3 cm on the left arm, and a 3 cm wound on the right arm.' })
    );
    expect(facts.wounds.map((w) => w.lengthCm)).toEqual([3, 3]);
  });
});

describe('extractLacerationFacts: clause boundaries bound the per-wound site', () => {
  it('a semicolon separates two wounds at two sites', () => {
    const facts = extractLacerationFacts(
      input({ procedureDetails: 'Nose bridge lac 2cm; 3 cm chest lac also closed.' })
    );
    expect(facts.wounds.map((w) => [w.lengthCm, w.site])).toEqual([
      [2, 'nose'],
      [3, 'trunk'],
    ]);
  });
});

describe('extractLacerationFacts: lexicon false positives', () => {
  it('a stray "superficial" describing another finding is not proof of a single-layer closure', () => {
    const facts = extractLacerationFacts(
      input({ procedureDetails: 'Wound 3 cm. Superficial partial-thickness abrasion adjacent. 3cm lac closed.' })
    );
    expect(facts.depth).toBeUndefined();
  });

  it('"superficial closure" still reads as single-layer', () => {
    expect(
      extractLacerationFacts(input({ procedureDetails: 'Superficial closure with 4-0 nylon.' })).depth?.value
    ).toBe('single-layer');
  });

  it('the everyday verb "let" is not the LET topical gel', () => {
    expect(
      extractLacerationFacts(input({ procedureDetails: 'Patient let us close the wound' })).anesthesiaDocumented
    ).toBeUndefined();
    expect(
      extractLacerationFacts(input({ procedureDetails: 'LET gel applied to the wound.' })).anesthesiaDocumented?.value
    ).toBe(true);
  });

  it('glueing a dressing is not a tissue-adhesive closure', () => {
    expect(
      extractLacerationFacts(input({ procedureDetails: 'Glued the dressing edges down.' })).tissueAdhesiveDocumented
    ).toBeUndefined();
  });

  it('an unavailable stapler is not staple evidence, and the sutures used still are', () => {
    const facts = extractLacerationFacts(input({ procedureDetails: 'Stapler unavailable, used sutures.' }));
    expect(facts.staplesDocumented).toBeUndefined();
    expect(facts.suturesDocumented?.value).toBe(true);
  });

  it('deferred and declined tetanus is not documented tetanus', () => {
    expect(
      extractLacerationFacts(input({ procedureDetails: 'Tetanus deferred, parents declined.' })).tetanusDocumented
    ).toBeUndefined();
  });

  it('planned irrigation is not documented irrigation', () => {
    expect(
      extractLacerationFacts(input({ procedureDetails: 'Will irrigate at follow-up.' })).irrigationDocumented
    ).toBeUndefined();
  });
});

describe('extractLacerationFacts: extraction reports facts, the family applies the CPT rules', () => {
  it('extensive cleaning is reported even without contamination language', () => {
    // The "cleaning only counts on the contaminated path" rule belongs to resolveRepairClass;
    // extraction must not destroy the documented fact.
    expect(
      extractLacerationFacts(input({ procedureDetails: 'Copiously irrigated with 500 mL saline.' }))
        .extensiveCleaningDocumented?.value
    ).toBe(true);
  });
});

describe('extractLacerationFacts: large input stays bounded', () => {
  it('ignores text beyond the analysis limit', () => {
    const text = 'x'.repeat(MAX_ANALYZED_TEXT_LENGTH) + ' Wound length: 3.2 cm.';
    expect(normalizeNoteText(text)).toHaveLength(MAX_ANALYZED_TEXT_LENGTH);
    expect(extractLacerationFacts(input({ procedureDetails: text })).wounds).toEqual([]);
  });
});

describe('lateralityDocumented: one meaning across the engine', () => {
  it('the structured Side of body field settles it', () => {
    expect(lateralityDocumented({ bodySide: 'Left' }, '')).toBe(true);
  });

  it('a whitespace-only Side of body field is not an answer', () => {
    expect(lateralityDocumented({ bodySide: '   ' }, '')).toBe(false);
  });

  // The text fallback used to be present in two families and absent in four, so a note that named
  // the side in prose was still told its laterality was undocumented.
  it.each([
    ['Left ear canal irrigated; canal clear afterwards.', true],
    ['Short arm splint applied to the right wrist.', true],
    ['Foreign body removed from the left hand.', true],
    ['Patient left before the dressing was changed.', false],
    ['Wound irrigated and closed.', false],
  ])('%s ⇒ %s', (procedureDetails, expected) => {
    expect(lateralityDocumented({}, procedureDetails)).toBe(expected);
  });

  it('a family with narrower vocabulary passes its own binding instead of the generic scan', () => {
    const naris = /\b(?:left|right)\b[^.;,\n]{0,12}\bnaris\b/i;
    expect(lateralityDocumented({}, 'Packing placed in the left naris.', naris)).toBe(true);
    expect(lateralityDocumented({}, 'Packing placed in the left hand.', naris)).toBe(false);
  });
});

describe('shared clinical vocabulary', () => {
  // The foreign-body and nasal-packing families each carried a near-copy of this; the union is what
  // one family accepted plus what the other did, so neither loses a wording it used to read.
  it.each([
    'hemostasis achieved',
    'bleeding controlled',
    'bleeding resolved',
    'no further bleeding',
    'no bleeding',
    'without bleeding',
    'epistaxis controlled',
  ])('"%s" documents hemostasis', (text) => {
    expect(HEMOSTASIS_PATTERN.test(text)).toBe(true);
  });

  it('a Technique selection is matched on its own, never across two selections', () => {
    const pattern = /sterile\s+field/i;
    expect(evidenceSource(techniqueOrTextFlag({ technique: ['Sterile field'] }, '', pattern))).toBe('field');
    expect(techniqueOrTextFlag({ technique: ['Sterile', 'Field'] }, '', pattern)).toBeUndefined();
  });
});
