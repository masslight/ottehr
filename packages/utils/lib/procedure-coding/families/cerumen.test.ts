import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { Finding, ProcedureFactsInput } from '../model.types';
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
const IRRIGATION_ONLY_TEXT = 'Ear canal irrigated with warm water; cerumen flushed out. Canal clear, TM intact.';

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

describe('cerumen detection', () => {
  it('detects the product procedure type display', () => {
    expect(detectProcedureFamily({ procedureType: 'Ear Lavage / Cerumen Removal' })?.id).toBe('cerumen');
    expect(detectProcedureFamily({ procedureType: 'ear-lavage' })?.id).toBe('cerumen');
  });

  it('detects from the selected 69210 alone', () => {
    expect(detectProcedureFamily({ cptCodes: [{ code: '69210', display: 'Removal impacted cerumen' }] })?.id).toBe(
      'cerumen'
    );
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
    ['micro-suction', 'Cerumen cleared by micro-suction under the microscope.'],
    ['forceps', 'Impacted cerumen removed piecemeal with alligator forceps.'],
  ])('instrumentation documented (%s) ⇒ 69210', (_label, details) => {
    const result = cerumenFamily.suggestCode(input({ procedureDetails: details }));
    expect(result.suggestion?.code).toBe('69210');
    expect(result.suggestion?.justification).toContain('instrumentation');
  });

  it('instrumentation recorded as a Technique value ⇒ 69210 without details text', () => {
    const result = cerumenFamily.suggestCode(input({ technique: ['Curette'], procedureDetails: '' }));
    expect(result.suggestion?.code).toBe('69210');
  });

  it('irrigation/lavage alone ⇒ no suggestion, the [C]-style finding, and the 69209 payer note', () => {
    const result = cerumenFamily.suggestCode(input({ procedureDetails: IRRIGATION_ONLY_TEXT }));
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'contradiction', 'irrigation alone does not qualify for 69210')).toBe(true);
    expect(result.payerNotes).toEqual([CERUMEN_IRRIGATION_PAYER_NOTE]);
  });

  it('both irrigation and instrumentation documented ⇒ 69210 (the instrumentation governs)', () => {
    const result = cerumenFamily.suggestCode(
      input({ procedureDetails: 'Canal irrigated, then residual impacted cerumen removed with curette. Canal clear.' })
    );
    expect(result.suggestion?.code).toBe('69210');
    expect(result.suggestion?.justification).toContain('instrumentation governs');
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });

  it('no method documented ⇒ [D] ask with 69210 as the open candidate', () => {
    const result = cerumenFamily.suggestCode(input({ procedureDetails: 'Cerumen removal performed.' }));
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'removal method is not documented')).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['69210']);
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
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '69210');
    expect(contradiction?.message).toContain('irrigation alone does not qualify for 69210');
    expect(contradiction?.message).toContain('curette, cerumen loop, micro-suction, or forceps');
    expect(contradiction?.sourceText).toContain('irrigated');
    expect(result.payerNotes).toEqual([CERUMEN_IRRIGATION_PAYER_NOTE]);
    expect(result.supportedCodes).toHaveLength(0);
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
    expect(result.supportedCodes).toEqual(['69210']);
  });

  it('laterality not documented ⇒ [R] naming the Side of body field, with the bilateral payer footnote', () => {
    const result = cerumenFamily.defendCodes(
      input({
        cptCodes: [{ code: '69210', display: 'Removal impacted cerumen' }],
        procedureDetails: INSTRUMENTATION_TEXT,
      })
    );
    const ask = result.findings.find((f) => f.level === 'required' && f.message.includes('Side of body field'));
    expect(ask).toBeDefined();
    expect(ask?.payerNote).toBe(CERUMEN_BILATERAL_PAYER_NOTE);
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
    expect(result.supportedCodes).toEqual(['69210']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
  });

  it('69209 (irrigation/lavage code) is outside scope ⇒ not assessed, never guessed', () => {
    const result = cerumenFamily.defendCodes(
      input({
        bodySide: 'Left',
        cptCodes: [{ code: '69209', display: 'Removal impacted cerumen using irrigation/lavage' }],
        procedureDetails: IRRIGATION_ONLY_TEXT,
      })
    );
    expect(result.notAssessedCodes).toEqual(['69209']);
    expect(result.findings).toHaveLength(0);
    expect(result.supportedCodes).toHaveLength(0);
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
    expect(result.supportedCodes).toEqual(['69210']);
    expect(result.notAssessedCodes).toEqual(['99213']);
  });
});

describe('cerumen family metadata', () => {
  it('does not use the structured length input (nothing in 69210 depends on a size)', () => {
    expect(cerumenFamily.usesStructuredLength).toBeUndefined();
  });
});
