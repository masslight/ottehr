import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AnatomicSite, normalizeAnatomicSite } from './extract';
import { extractCerumenFacts } from './families/cerumen';
import { extractForeignBodyFacts } from './families/foreign-body';
import { extractIncisionDrainageFacts } from './families/incision-drainage';
import { extractLacerationFacts } from './families/laceration';
import { extractSplintingFacts } from './families/splinting';
import { ProcedureFactsInput } from './model.types';

const CONFIG_DIR = new URL('../../../../config/oystehr/', import.meta.url);

const TECHNIQUES_URL = 'https://fhir.ottehr.com/ValueSet/procedure-techniques';
const SUPPLIES_URL = 'https://fhir.ottehr.com/ValueSet/procedure-supplies';
const BODY_SITES_URL = 'https://fhir.ottehr.com/ValueSet/procedure-body-sites';
const PROCEDURE_TYPES_URL = 'https://fhir.ottehr.com/ValueSet/procedure-type';

interface SeededConcept {
  code?: string;
  display?: string;
  extension?: Array<{
    url?: string;
    valueCodeableConcept?: { coding?: Array<{ code?: string }> };
  }>;
}

interface SeededValueSet {
  resourceType?: string;
  url?: string;
  version?: string;
  expansion?: { contains?: SeededConcept[] };
}

function liveConcepts(fileName: string, url: string): SeededConcept[] {
  const raw = JSON.parse(readFileSync(new URL(fileName, CONFIG_DIR), 'utf8')) as {
    fhirResources: Record<string, { resource: SeededValueSet }>;
  };
  const latest = Object.values(raw.fhirResources)
    .map((entry) => entry.resource)
    .filter((resource) => resource.resourceType === 'ValueSet' && resource.url === url)
    .sort((a, b) => (a.version ?? '').localeCompare(b.version ?? '', undefined, { numeric: true }))
    .at(-1);
  const concepts = latest?.expansion?.contains ?? [];
  expect(concepts.length, `${fileName} has no expansion for ${url}`).toBeGreaterThan(0);
  return concepts;
}

function liveDisplays(fileName: string, url: string): string[] {
  return liveConcepts(fileName, url).flatMap((concept) => (concept.display === undefined ? [] : [concept.display]));
}

// ── The curated table ──────────────────────────────────────────────────────────

interface OptionContract {
  /** The display string exactly as committed. A rename here is the failure this file exists for. */
  display: string;
  /**
   * Drives the real extraction with the option selected and returns the fact it must establish.
   * `null` where the option deliberately drives no coding fact — `why` then says why.
   */
  fact: ((display: string) => unknown) | null;
  /** What the option is for, in one line. Read this before adding a `null`. */
  why: string;
}

function technique(display: string): ProcedureFactsInput {
  return { technique: [display] };
}
function supply(display: string): ProcedureFactsInput {
  return { suppliesUsed: [display] };
}

const TECHNIQUE_CONTRACT: OptionContract[] = [
  { display: 'Sterile', fact: null, why: 'asepsis, not a coding determinant in any family' },
  { display: 'Clean', fact: null, why: 'asepsis, not a coding determinant in any family' },
  { display: 'Aseptic', fact: null, why: 'asepsis, not a coding determinant in any family' },
  { display: 'Field', fact: null, why: 'asepsis (clean/sterile field), not a coding determinant' },
  {
    display: 'Curette',
    fact: (d) => extractCerumenFacts(technique(d)).instrumentationDocumented?.value,
    why: '69210 is removal requiring instrumentation',
  },
  {
    display: 'Cerumen Loop',
    fact: (d) => extractCerumenFacts(technique(d)).instrumentationDocumented?.value,
    why: '69210 is removal requiring instrumentation',
  },
  {
    display: 'Micro-suction',
    fact: (d) => extractCerumenFacts(technique(d)).instrumentationDocumented?.value,
    why: '69210 is removal requiring instrumentation',
  },
  {
    display: 'Irrigation / Lavage',
    fact: (d) => extractCerumenFacts(technique(d)).irrigationDocumented?.value,
    why: '69209 is removal by irrigation and/or lavage',
  },
  {
    display: 'Slit Lamp',
    fact: (d) => extractForeignBodyFacts({ ...technique(d), bodySite: 'Eye' }).slitLampDocumented?.value,
    why: 'slit-lamp use is inside the definition of 65222',
  },
  {
    display: 'Forceps',
    fact: (d) => extractCerumenFacts(technique(d)).instrumentationDocumented?.value,
    why: 'qualifying instrumentation for 69210',
  },
  {
    display: 'Splinter Forceps',
    fact: (d) => extractCerumenFacts(technique(d)).instrumentationDocumented?.value,
    why: 'qualifying instrumentation for 69210 (it is the foreign-body instrument, but the cerumen instrumentation vocabulary claims it and that is the only code it can move)',
  },
  {
    display: 'Blunt Dissection',
    fact: (d) =>
      extractIncisionDrainageFacts(technique(d)).complexityElements.some(
        (element) => element.value === 'loculations-dissection'
      ),
    why: 'a complexity element that selects 10061 over 10060',
  },
  {
    display: 'Probing',
    fact: (d) =>
      extractIncisionDrainageFacts(technique(d)).complexityElements.some((element) => element.value === 'probing'),
    why: 'a complexity element that selects 10061 over 10060',
  },
  {
    display: 'Short Arm Splint',
    fact: (d) => extractSplintingFacts(technique(d)).splintRegion?.value,
    why: 'the splint region selects 29125/29126',
  },
  {
    display: 'Long Arm Splint',
    fact: (d) => extractSplintingFacts(technique(d)).splintRegion?.value,
    why: 'the splint region selects 29105',
  },
  {
    display: 'Short Leg Splint',
    fact: (d) => extractSplintingFacts(technique(d)).splintRegion?.value,
    why: 'the splint region selects 29515',
  },
  {
    display: 'Long Leg Splint',
    fact: (d) => extractSplintingFacts(technique(d)).splintRegion?.value,
    why: 'the splint region selects 29505',
  },
  {
    display: 'Sugar-Tong Splint',
    fact: (d) => extractSplintingFacts(technique(d)).splintRegion?.value,
    why: 'a sugar-tong splint is short-arm territory (29125/29126)',
  },
  {
    // Recorded judgement, not an oversight: "posterior" names the mould's aspect, not the
    // territory immobilized — a posterior splint can be a short leg, a long leg or a long arm. The
    // family reads it as a splint (so the appliance is settled) and then asks for the region, which
    // is the honest answer rather than a guessed code.
    display: 'Posterior Splint',
    fact: (d) => extractSplintingFacts(technique(d)).splintDocumented?.value,
    why: 'establishes the appliance; the region stays a [D] ask because "posterior" is genuinely ambiguous',
  },
  {
    display: 'Finger Splint',
    fact: (d) => extractSplintingFacts(technique(d)).splintRegion?.value,
    why: 'the splint region selects 29130/29131',
  },
  {
    display: 'Strapping',
    fact: (d) => extractSplintingFacts(technique(d)).strappingDocumented?.value,
    why: 'the appliance selects the strapping codes over the splint codes',
  },
];

/** The region each splint technique must resolve to, checked separately so a swap cannot pass. */
const SPLINT_TECHNIQUE_REGIONS: Array<[string, string]> = [
  ['Short Arm Splint', 'short-arm'],
  ['Long Arm Splint', 'long-arm'],
  ['Short Leg Splint', 'short-leg'],
  ['Long Leg Splint', 'long-leg'],
  ['Sugar-Tong Splint', 'short-arm'],
  ['Finger Splint', 'finger'],
];

const SUPPLY_CONTRACT: OptionContract[] = [
  {
    display: 'Suture Kit',
    fact: (d) => extractLacerationFacts(supply(d)).suturesDocumented?.value,
    why: 'corroborates a suture closure, so the wound never reads as strips-only',
  },
  {
    // Recorded judgement: a bare "Splint" is an equipment record, and reading it as appliance
    // evidence would let a stocked item contradict a selected strapping code ("the note documents a
    // splint only"). A wrong contradiction from a weak signal is the worst failure mode here, so the
    // appliance stays with the Technique selections and the narrative. Fiberglass and Plaster below
    // are different: they are what a splint is made of, and they only ever satisfy an [R].
    display: 'Splint',
    fact: null,
    why: 'equipment record; too weak to be appliance evidence without manufacturing contradictions',
  },
  { display: 'Irrigation Syringe', fact: null, why: 'equipment record; irrigation is read from the narrative' },
  { display: 'Speculum', fact: null, why: 'equipment record; no code in scope turns on it' },
  { display: 'Forceps', fact: null, why: 'equipment record; instrumentation is a Technique selection' },
  { display: 'IV Kit', fact: null, why: 'equipment record; the administration route is what codes 96372-96366' },
  {
    display: 'Iodoform Packing Strip',
    fact: (d) =>
      extractIncisionDrainageFacts(supply(d)).complexityElements.some((element) => element.value === 'packing'),
    why: 'packing is a complexity element behind 10061',
  },
  {
    display: 'Drain',
    fact: (d) =>
      extractIncisionDrainageFacts(supply(d)).complexityElements.some((element) => element.value === 'drain-placement'),
    why: 'drain placement is a complexity element behind 10061',
  },
  {
    display: 'Tissue Adhesive (e.g. Dermabond)',
    fact: (d) => extractLacerationFacts(supply(d)).tissueAdhesiveDocumented?.value,
    why: 'a tissue-adhesive-only closure is a simple repair (and carries the G0168 payer note)',
  },
  {
    display: 'Steri-Strips',
    fact: (d) => extractLacerationFacts(supply(d)).adhesiveStripsDocumented?.value,
    why: 'adhesive strips alone support no repair code at all',
  },
  {
    display: 'Fiberglass',
    fact: (d) => extractSplintingFacts({ ...supply(d), technique: ['Short Arm Splint'] }).materialDocumented?.value,
    why: 'the splint material satisfies the documentation reminder for splint codes',
  },
  {
    display: 'Plaster',
    fact: (d) => extractSplintingFacts({ ...supply(d), technique: ['Short Arm Splint'] }).materialDocumented?.value,
    why: 'the splint material satisfies the documentation reminder for splint codes',
  },
  {
    display: 'Unna Boot',
    fact: (d) => extractSplintingFacts(supply(d)).unnaBootDocumented?.value,
    why: '29580 is defined by the appliance',
  },
  { display: 'Other', fact: null, why: 'hands the answer to the free-text Other supplies field' },
];

const BODY_SITE_CONTRACT: Array<{ display: string; site: AnatomicSite | null; why: string }> = [
  { display: 'Head', site: 'scalp', why: 'the non-face head groups with the scalp for repair banding' },
  { display: 'Face', site: 'face', why: '' },
  { display: 'Arm', site: 'extremity', why: '' },
  { display: 'Leg', site: 'extremity', why: '' },
  { display: 'Torso', site: 'trunk', why: '' },
  { display: 'Genital', site: 'genitalia', why: '' },
  { display: 'Ear', site: 'ear', why: '' },
  { display: 'Nose', site: 'nose', why: '' },
  {
    // Recorded judgement, and the one deliberate non-resolution besides 'Other': "Eye" does not say
    // whether the lesion is on the globe (nowhere near this model's scope) or on the lid (a
    // 12011-12018 repair), and picking one would be a guessed code table. The foreign-body family
    // reads "Eye" through its own branch pattern and asks which structure it was, which is the
    // honest answer; the repair family asks for the site.
    display: 'Eye',
    site: null,
    why: 'globe vs lid is unresolved, and the two are coded nowhere near each other',
  },
  { display: 'Hand', site: 'hand', why: '' },
  { display: 'Foot', site: 'foot', why: '' },
  { display: 'Neck', site: 'neck', why: '' },
  { display: 'Finger', site: 'hand', why: 'the hand band group covers the fingers' },
  { display: 'Chest', site: 'trunk', why: '' },
  { display: 'Shoulder', site: 'extremity', why: '' },
  { display: 'Hip', site: 'extremity', why: 'a limb root, paired, and in the trunk/extremity band group either way' },
  { display: 'Knee', site: 'extremity', why: '' },
  { display: 'Ankle', site: 'extremity', why: '' },
  { display: 'Other', site: null, why: 'hands the answer to the free-text Other body site field' },
];

// ── The assertions ─────────────────────────────────────────────────────────────

/** The table has to be exhaustive over the live expansion, and spell each display exactly. */
function expectTableCoversValueSet(fileName: string, displays: string[], tabled: string[]): void {
  const missing = displays.filter((display) => !tabled.includes(display));
  const stale = tabled.filter((display) => !displays.includes(display));
  expect(
    missing,
    `${fileName} offers ${JSON.stringify(missing)}, which no row of this contract table covers. ` +
      'Add a row naming the engine fact the option drives, or a row with fact: null and the reason it drives none.'
  ).toEqual([]);
  expect(
    stale,
    `this contract table expects ${JSON.stringify(stale)} in ${fileName}, and the committed ValueSet ` +
      'does not offer it. The display was renamed or removed — the engine matches on the display string, ' +
      'so the mapping is broken until the table and the patterns agree again.'
  ).toEqual([]);
}

function expectRowsEstablishTheirFact(rows: OptionContract[], fileName: string): void {
  for (const row of rows) {
    if (row.fact === null) continue;
    expect(
      row.fact(row.display),
      `"${row.display}" (${fileName}) no longer establishes the fact behind it — ${row.why}. ` +
        'The engine reads this option by its display string, so a rename in the ValueSet or an edit ' +
        'to the pattern breaks code determination silently.'
    ).toBeTruthy();
  }
}

describe('procedure-techniques ValueSet ⇄ engine', () => {
  const displays = liveDisplays('procedure-techniques.json', TECHNIQUES_URL);

  it('every committed technique display is accounted for', () => {
    expectTableCoversValueSet(
      'procedure-techniques.json',
      displays,
      TECHNIQUE_CONTRACT.map((row) => row.display)
    );
  });

  it('every technique that drives a fact still drives it', () => {
    expectRowsEstablishTheirFact(TECHNIQUE_CONTRACT, 'procedure-techniques.json');
  });

  it.each(SPLINT_TECHNIQUE_REGIONS)('%s resolves to the %s region', (display, region) => {
    expect(extractSplintingFacts({ technique: [display] }).splintRegion?.value).toBe(region);
  });

  it('Posterior Splint settles the appliance but leaves the region an honest ask', () => {
    const facts = extractSplintingFacts({ technique: ['Posterior Splint'] });
    expect(facts.splintDocumented?.value).toBe(true);
    expect(facts.splintRegion).toBeUndefined();
  });
});

describe('procedure-supplies ValueSet ⇄ engine', () => {
  const displays = liveDisplays('procedure-supplies.json', SUPPLIES_URL);

  it('every committed supply display is accounted for', () => {
    expectTableCoversValueSet(
      'procedure-supplies.json',
      displays,
      SUPPLY_CONTRACT.map((row) => row.display)
    );
  });

  it('every supply that drives a code still drives it', () => {
    expectRowsEstablishTheirFact(SUPPLY_CONTRACT, 'procedure-supplies.json');
  });
});

describe('procedure-body-sites ValueSet ⇄ engine', () => {
  const displays = liveDisplays('procedure-body-sites.json', BODY_SITES_URL);

  it('every committed body-site display is accounted for', () => {
    expectTableCoversValueSet(
      'procedure-body-sites.json',
      displays,
      BODY_SITE_CONTRACT.map((row) => row.display)
    );
  });

  it('every body-site display resolves to the site the engine bands from', () => {
    for (const row of BODY_SITE_CONTRACT) {
      if (row.site === null) continue;
      expect(
        normalizeAnatomicSite(row.display),
        `body site "${row.display}" no longer resolves to an anatomic site — ${row.why || 'it is a seeded option'}. ` +
          'An unresolved site makes the engine ask for a body site the provider already picked.'
      ).toBe(row.site);
    }
  });

  it('the two deliberate non-resolutions are exactly Eye and Other', () => {
    expect(BODY_SITE_CONTRACT.filter((row) => row.site === null).map((row) => row.display)).toEqual(['Eye', 'Other']);
  });
});

describe('procedure-types ValueSet ⇄ injection/infusion engine', () => {
  it('offers the IV push path with its confirmed 96374 mapping', () => {
    const ivPush = liveConcepts('procedure-type.json', PROCEDURE_TYPES_URL).find(
      (concept) => concept.code === 'iv-push-medication-administration'
    );
    const mappedCodes = (ivPush?.extension ?? []).flatMap(
      (extension) => extension.valueCodeableConcept?.coding?.flatMap((coding) => coding.code ?? []) ?? []
    );

    expect(ivPush?.display).toBe('IV Push Medication Administration');
    expect(mappedCodes).toContain('96374');
  });
});
