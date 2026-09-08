import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { ProcedureFactsInput } from '../model.types';
import {
  citedText,
  evidenceSource,
  findingCode,
  hasFinding,
  notAssessedCodes,
  offeredCandidates,
  offeredSummary,
  suggestionOf,
  supportedCodes,
} from '../test-support';
import {
  CERUMEN_BILATERAL_PAYER_NOTE,
  CERUMEN_IRRIGATION_PAYER_NOTE,
  cerumenFamily,
  extractCerumenFacts,
} from './cerumen';
import { foreignBodyFamily } from './foreign-body';
import { lacerationFamily } from './laceration';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Ear Lavage / Cerumen Removal', ...overrides };
}

const INSTRUMENTATION_TEXT =
  'Impacted cerumen removed with curette under direct visualization. Canal clear, TM intact.';
const IRRIGATION_ONLY_TEXT =
  'Ear canal irrigated with warm water; impacted cerumen flushed out. Canal clear, TM intact.';
const IRRIGATION_NO_IMPACTION_TEXT =
  'Ear canal irrigated with warm water; cerumen flushed out. Canal clear, TM intact.';

describe('cerumen detection', () => {
  it('detects the product procedure type display', () => {
    expect(detectProcedureFamily({ procedureType: 'Ear Lavage / Cerumen Removal' })?.id).toBe('cerumen');
    expect(detectProcedureFamily({ procedureType: 'ear-lavage' })?.id).toBe('cerumen');
  });

  it.each(['69209', '69210'])('detects from the selected %s alone', (code) => {
    expect(detectProcedureFamily({ cptCodes: [{ code, display: 'Removal impacted cerumen' }] })?.id).toBe('cerumen');
  });

  it('does not claim laceration or foreign-body entries, and they do not claim cerumen entries', () => {
    expect(cerumenFamily.detect({ procedureType: 'Laceration Repair (Suturing/Stapling)' })).toBe(false);
    expect(cerumenFamily.detect({ procedureType: 'Foreign Body Removal (Skin, Ear, Nose, Eye)' })).toBe(false);
    expect(lacerationFamily.detect({ procedureType: 'Ear Lavage / Cerumen Removal' })).toBe(false);
    expect(foreignBodyFamily.detect({ procedureType: 'Ear Lavage / Cerumen Removal' })).toBe(false);
  });
});

describe('cerumen forward: the method is the code definition', () => {
  it.each([
    ['curette', 'Impacted cerumen removed with curette under otoscopic visualization.'],
    ['cerumen loop', 'Cerumen loop used to remove the impaction from the canal.'],
    ['micro-suction', 'Impacted cerumen cleared by micro-suction under the microscope.'],
    ['forceps', 'Impacted cerumen removed piecemeal with alligator forceps.'],
  ])('instrumentation documented (%s) ⇒ 69210', (_label, details) => {
    const result = cerumenFamily.suggestCode(input({ procedureDetails: details }));
    expect(suggestionOf(result)?.code).toBe('69210');
    expect(suggestionOf(result)?.justification).toContain('instrumentation');
  });

  it('instrumentation recorded as a Technique value ⇒ 69210 without details text', () => {
    const result = cerumenFamily.suggestCode(
      input({
        technique: ['Curette'],
        diagnoses: [{ code: 'H61.21', display: 'Impacted cerumen, right ear' }],
        procedureDetails: '',
      })
    );
    expect(suggestionOf(result)?.code).toBe('69210');
  });

  it('irrigation/lavage alone with impaction documented ⇒ 69209 without a forward contradiction', () => {
    const result = cerumenFamily.suggestCode(input({ procedureDetails: IRRIGATION_ONLY_TEXT }));
    expect(suggestionOf(result)?.code).toBe('69209');
    expect(suggestionOf(result)?.justification).toContain('irrigation/lavage');
    expect(result.findings.filter((finding) => finding.level === 'contradiction')).toHaveLength(0);
    expect(result.payerNotes).toEqual([CERUMEN_IRRIGATION_PAYER_NOTE]);
  });

  it('both irrigation and instrumentation documented ⇒ 69210 (the instrumentation governs)', () => {
    const result = cerumenFamily.suggestCode(
      input({ procedureDetails: 'Canal irrigated, then residual impacted cerumen removed with curette. Canal clear.' })
    );
    expect(suggestionOf(result)?.code).toBe('69210');
    expect(suggestionOf(result)?.justification).toContain('instrumentation governs');
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });

  it('no method documented ⇒ [D] ask over both codes as the open candidates', () => {
    const result = cerumenFamily.suggestCode(input({ procedureDetails: 'Impacted cerumen removal performed.' }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'removal method is not documented')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['69209', '69210']);
    expect(offeredSummary(result.outcome)).toBe(
      '69209–69210 — the removal method (irrigation/lavage vs instrumentation) determines the code'
    );
  });
});

describe('cerumen forward: both codes require documented impaction', () => {
  it('instrumentation without documented impaction ⇒ [D] ask, not a confident 69210', () => {
    const result = cerumenFamily.suggestCode(
      input({ procedureDetails: 'Cerumen removed with curette. Canal clear, TM intact.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', /impaction is not documented.*support 69210/)).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['69210']);
    expect(offeredSummary(result.outcome)).toContain('69210 only');
    expect(offeredSummary(result.outcome)).toContain('visit (E/M) charge');
  });

  it('irrigation without documented impaction ⇒ [D] ask over 69209 alone', () => {
    const result = cerumenFamily.suggestCode(input({ procedureDetails: IRRIGATION_NO_IMPACTION_TEXT }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', /impaction is not documented.*support 69209/)).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['69209']);
    expect(result.payerNotes).toEqual([CERUMEN_IRRIGATION_PAYER_NOTE]);
  });

  it('a note that denies impaction ⇒ [C] against both codes, no suggestion', () => {
    const result = cerumenFamily.suggestCode(
      input({ procedureDetails: 'No impaction seen; routine wax removed with curette. Canal clear, TM intact.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    const contradiction = result.findings.find((f) => f.level === 'contradiction');
    expect(contradiction?.message).toContain('was not impacted');
    expect(contradiction?.message).toContain('visit (E/M) charge');
    expect(citedText(contradiction)).toContain('No impaction');
    expect(offeredCandidates(result.outcome)).toBeUndefined();
  });

  it('an H61.2x diagnosis carries the impaction for the forward direction too', () => {
    const result = cerumenFamily.suggestCode(
      input({
        diagnoses: [{ code: 'H6121', display: 'Impacted cerumen, right ear' }],
        procedureDetails: 'Cerumen removed with curette. Canal clear, TM intact.',
      })
    );
    expect(suggestionOf(result)?.code).toBe('69210');
  });
});

describe('cerumen: 69209 and 69210 are unilateral codes', () => {
  it('documented bilateral removal ⇒ the bilateral payer note on the forward suggestion', () => {
    const result = cerumenFamily.suggestCode(input({ bodySide: 'Bilateral', procedureDetails: INSTRUMENTATION_TEXT }));
    expect(suggestionOf(result)?.code).toBe('69210');
    expect(result.payerNotes).toEqual([CERUMEN_BILATERAL_PAYER_NOTE]);
    expect(hasFinding(result.findings, 'bestPractice', 'unilateral codes')).toBe(true);
  });

  it('documented bilateral removal ⇒ the bilateral payer note on the inverse too', () => {
    const result = cerumenFamily.defendCodes(
      input({
        bodySide: 'Bilateral',
        diagnoses: [{ code: 'H61.23', display: 'Impacted cerumen, bilateral' }],
        cptCodes: [{ code: '69210', display: 'Removal impacted cerumen' }],
        procedureDetails: INSTRUMENTATION_TEXT,
      })
    );
    expect(supportedCodes(result)).toEqual(['69210']);
    expect(result.payerNotes).toEqual([CERUMEN_BILATERAL_PAYER_NOTE]);
    const note = result.findings.find((f) => f.level === 'bestPractice');
    expect(note?.payerNote).toBe(CERUMEN_BILATERAL_PAYER_NOTE);
    expect(evidenceSource(note)).toBe('field');
  });

  it('bilateral removal documented in the text alone is still caught', () => {
    const facts = extractCerumenFacts(
      input({ procedureDetails: 'Impacted cerumen removed from both ears with curette.' })
    );
    expect(facts.bilateralDocumented?.value).toBe(true);
  });

  it('a both-ears post-procedure exam is not a bilateral removal', () => {
    const facts = extractCerumenFacts(
      input({ bodySide: 'Left', procedureDetails: 'Impacted cerumen removed with curette. Both canals clear.' })
    );
    expect(facts.bilateralDocumented).toBeUndefined();
  });
});

describe('cerumen: the instrumentation lexicon', () => {
  it.each([
    ['no instrumentation needed', 'Impacted cerumen flushed out; no instrumentation needed. Canal clear.'],
    ['instruments only mentioned', 'Instruments were laid out but not required; impacted cerumen irrigated out.'],
    ['suction only at the bedside', 'Suction equipment ready at the bedside; impacted cerumen irrigated out.'],
  ])('"%s" does not count as instrumentation', (_label, details) => {
    const facts = extractCerumenFacts(input({ procedureDetails: details }));
    expect(facts.instrumentationDocumented).toBeUndefined();
    expect(suggestionOf(cerumenFamily.suggestCode(input({ procedureDetails: details })))?.code).toBe('69209');
  });

  it.each([
    ['micro-suction', 'Impacted cerumen cleared by micro-suction.'],
    ['canal suctioned', 'Impacted cerumen suctioned from the canal under direct visualization.'],
    ['requiring instrumentation', 'Impacted cerumen removal requiring instrumentation performed.'],
  ])('"%s" does count as instrumentation', (_label, details) => {
    const facts = extractCerumenFacts(input({ procedureDetails: details }));
    expect(facts.instrumentationDocumented?.value).toBe(true);
  });
});

describe('cerumen inverse: pinned contradiction case', () => {
  it('69210 selected with irrigation/lavage alone documented ⇒ [C] + the 69209 payer note', () => {
    const result = cerumenFamily.defendCodes(
      input({
        bodySide: 'Left',
        cptCodes: [{ code: '69210', display: 'Removal impacted cerumen' }],
        procedureDetails: IRRIGATION_ONLY_TEXT,
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '69210');
    expect(contradiction?.message).toContain('irrigation alone does not qualify for 69210');
    expect(contradiction?.message).toContain('curette, cerumen loop, micro-suction, or forceps');
    expect(citedText(contradiction)).toContain('irrigated');
    expect(result.payerNotes).toEqual([CERUMEN_IRRIGATION_PAYER_NOTE]);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('69210 selected with no method documented ⇒ [D] ask, not a contradiction', () => {
    const result = cerumenFamily.defendCodes(
      input({
        bodySide: 'Left',
        cptCodes: [{ code: '69210', display: 'Removal impacted cerumen' }],
        procedureDetails: 'Impacted cerumen removed. Canal clear, TM intact.',
      })
    );
    expect(hasFinding(result.findings, 'determines', 'removal method is not documented', '69210')).toBe(true);
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });
});

describe('cerumen inverse: [R] elements', () => {
  it('impaction not documented ⇒ [R] pointing at the H61.2x diagnosis or details', () => {
    const result = cerumenFamily.defendCodes(
      input({
        bodySide: 'Left',
        cptCodes: [{ code: '69210', display: 'Removal impacted cerumen' }],
        procedureDetails: 'Cerumen removed with curette. Canal clear, TM intact.',
      })
    );
    const ask = result.findings.find((f) => f.level === 'required' && /impaction/i.test(f.message));
    expect(ask?.message).toContain('payers require documented impaction');
    expect(ask?.message).toContain('impacted-cerumen diagnosis (H61.2x)');
  });

  it('an H61.2x diagnosis satisfies the impaction requirement', () => {
    const result = cerumenFamily.defendCodes(
      input({
        bodySide: 'Left',
        diagnoses: [{ code: 'H61.23', display: 'Impacted cerumen, bilateral' }],
        cptCodes: [{ code: '69210', display: 'Removal impacted cerumen' }],
        procedureDetails: 'Cerumen removed with curette. Canal clear, TM intact.',
      })
    );
    expect(hasFinding(result.findings, 'required', /impaction/i)).toBe(false);
    expect(supportedCodes(result)).toEqual(['69210']);
  });

  it('laterality not documented ⇒ [R] naming the Side of body field, and no bilateral payer note', () => {
    const result = cerumenFamily.defendCodes(
      input({
        cptCodes: [{ code: '69210', display: 'Removal impacted cerumen' }],
        procedureDetails: INSTRUMENTATION_TEXT,
      })
    );
    const ask = result.findings.find((f) => f.level === 'required' && f.message.includes('Side of body field'));
    expect(ask).toBeDefined();
    expect(ask?.payerNote).toBeUndefined();
    expect(result.payerNotes).toEqual([]);
  });

  it('post-procedure exam not documented ⇒ [R] asking for canal clear / TM intact', () => {
    const result = cerumenFamily.defendCodes(
      input({
        bodySide: 'Left',
        cptCodes: [{ code: '69210', display: 'Removal impacted cerumen' }],
        procedureDetails: 'Impacted cerumen removed with curette under direct visualization.',
      })
    );
    expect(hasFinding(result.findings, 'required', /canal is clear and the TM intact/, '69210')).toBe(true);
  });

  it.each(['Canals clear.', 'Both canals clear.'])('plural "%s" satisfies the post-procedure exam', (text) => {
    const facts = extractCerumenFacts(input({ procedureDetails: `Impacted cerumen removed with curette. ${text}` }));
    expect(facts.postExamDocumented?.value).toBe(true);
  });
});

describe('cerumen inverse: supported state and scope honesty', () => {
  it('fully documented entry supports 69210 with no [D]/[R]/[C] findings', () => {
    const result = cerumenFamily.defendCodes(
      input({
        bodySide: 'Right',
        cptCodes: [{ code: '69210', display: 'Removal impacted cerumen' }],
        procedureDetails: INSTRUMENTATION_TEXT,
      })
    );
    expect(supportedCodes(result)).toEqual(['69210']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
  });

  it('69209 with irrigation and impaction documented ⇒ supported, with no findings', () => {
    const result = cerumenFamily.defendCodes(
      input({
        bodySide: 'Left',
        cptCodes: [{ code: '69209', display: 'Removal impacted cerumen using irrigation/lavage' }],
        procedureDetails: IRRIGATION_ONLY_TEXT,
      })
    );
    expect(supportedCodes(result)).toEqual(['69209']);
    expect(notAssessedCodes(result)).toHaveLength(0);
    expect(result.findings).toHaveLength(0);
  });

  it('69209 selected but instrumentation documented ⇒ [C], because instrumentation governs', () => {
    const result = cerumenFamily.defendCodes(
      input({
        bodySide: 'Left',
        cptCodes: [{ code: '69209', display: 'Removal impacted cerumen using irrigation/lavage' }],
        procedureDetails: 'Canal irrigated, then residual impacted cerumen removed with curette. Canal clear.',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '69209');
    expect(contradiction?.message).toContain('instrumentation governs');
    expect(contradiction?.message).toContain('supports 69210');
    expect(citedText(contradiction)).toContain('curette');
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('69209 with no method documented ⇒ [D] ask naming the irrigation/lavage definition', () => {
    const result = cerumenFamily.defendCodes(
      input({
        bodySide: 'Left',
        cptCodes: [{ code: '69209', display: 'Removal impacted cerumen using irrigation/lavage' }],
        procedureDetails: 'Impacted cerumen removed. Canal clear, TM intact.',
      })
    );
    expect(hasFinding(result.findings, 'determines', /removal method is not documented for 69209/, '69209')).toBe(true);
    expect(hasFinding(result.findings, 'determines', 'Procedure details', '69209')).toBe(true);
  });

  it('a selected code with a note that denies impaction ⇒ [C], not a missing-element [R]', () => {
    const result = cerumenFamily.defendCodes(
      input({
        bodySide: 'Left',
        cptCodes: [{ code: '69210', display: 'Removal impacted cerumen' }],
        procedureDetails: 'No impaction seen; routine wax removed with curette. Canal clear, TM intact.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'was not impacted', '69210')).toBe(true);
    expect(hasFinding(result.findings, 'required', /impaction/i)).toBe(false);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('mixed selection: 69210 judged, out-of-family code listed not assessed', () => {
    const result = cerumenFamily.defendCodes(
      input({
        bodySide: 'Right',
        cptCodes: [
          { code: '69210', display: 'Removal impacted cerumen' },
          { code: '99213', display: 'Office visit' },
        ],
        procedureDetails: INSTRUMENTATION_TEXT,
      })
    );
    expect(supportedCodes(result)).toEqual(['69210']);
    expect(notAssessedCodes(result)).toEqual(['99213']);
  });
});

describe('cerumen family metadata', () => {
  it('does not use the structured length input (nothing in 69210 depends on a size)', () => {
    expect(cerumenFamily.structuredFieldsFor({})).toEqual([]);
  });
});
