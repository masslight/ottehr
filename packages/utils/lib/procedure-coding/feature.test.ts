import { describe, expect, it } from 'vitest';
import {
  ALL_VISITS,
  CODE_CHECKS,
  COMPLEX_REPAIR,
  DRAINAGE,
  FormAnswers,
  INTERMEDIATE_REPAIR,
  LACERATION,
  SIMPLE_REPAIR,
  UNFINISHED_FORMS,
} from './coding-scenarios';
import { suggestedCodes } from './cpt';
import { defendCodes, detectProcedureFamily, PROCEDURE_FAMILIES, suggestCode } from './evaluate';
import { CodeAssessmentKind, CptCodeRef, ProcedureFactsInput } from './model.types';
import { parseStructuredFacts, StructuredFacts } from './structured-fields';

/** Finds the family that owns a procedure name, the way the page does. */
function familyFor(procedure: string): (typeof PROCEDURE_FAMILIES)[number] {
  const family = detectProcedureFamily({ procedureType: procedure });
  if (!family) throw new Error(`No coding family owns the procedure type "${procedure}"`);
  return family;
}

/** Translates answers written with on-screen labels into the keys the engine uses.
 *  A label that is not on the form fails the test, so the tables cannot drift from the UI. */
function answersToFacts(
  fields: readonly { label: string; key: string; fields?: unknown }[],
  answers: FormAnswers
): StructuredFacts {
  const byLabel = new Map(fields.map((field) => [field.label, field]));
  const facts: StructuredFacts = {};
  for (const [label, value] of Object.entries(answers)) {
    const field = byLabel.get(label);
    if (!field) {
      throw new Error(`The form has no field labelled "${label}". It has: ${[...byLabel.keys()].join(', ')}`);
    }
    facts[field.key] = Array.isArray(value)
      ? value.map(
          (row) =>
            answersToFacts(field.fields as readonly { label: string; key: string }[], row as FormAnswers) as Record<
              string,
              string | number | boolean | undefined
            >
        )
      : value;
  }
  return facts;
}

const evaluate = (procedure: string, answers: FormAnswers): ProcedureFactsInput => ({
  procedureType: procedure,
  structuredFacts: answersToFacts([...familyFor(procedure).fields], answers),
  context: { completeDay: true, otherProcedures: [] },
});

/** Renders a suggested line the way a biller writes it: code, modifiers, then units if above one. */
const asBilled = (procedure: string, answers: FormAnswers): string[] =>
  suggestedCodes(suggestCode(evaluate(procedure, answers))).map(
    (line) =>
      `${line.code}` +
      `${line.modifiers?.length ? `-${line.modifiers.join('-')}` : ''}` +
      `${line.units && line.units > 1 ? ` x${line.units}` : ''}`
  );

const messages = (procedure: string, answers: FormAnswers): string[] =>
  suggestCode(evaluate(procedure, answers)).findings.map((finding) => finding.message);

describe('every visit produces the codes the table says', () => {
  it.each(ALL_VISITS.map((entry) => [entry.visit, entry] as const))('%s', (_name, entry) => {
    expect(asBilled(entry.procedure, entry.answers)).toEqual(entry.suggests);
    if (entry.tells !== undefined) expect(messages(entry.procedure, entry.answers)).toContain(entry.tells);
  });
});

const woundAnswers = (site: string, lengthCm: number, extra: FormAnswers = {}): FormAnswers => ({
  Wounds: [{ Site: site, 'Length (cm)': lengthCm, Closure: 'single layer', ...extra } as never],
});

describe('wound repair — stitches through the skin only', () => {
  it.each(SIMPLE_REPAIR)('%s, %s cm → %s', (site, lengthCm, code) => {
    expect(asBilled(LACERATION, woundAnswers(site, lengthCm))).toEqual([code]);
  });
});

describe('wound repair — a deeper repair after heavy contamination', () => {
  it.each(INTERMEDIATE_REPAIR)('%s, %s cm → %s', (site, lengthCm, code) => {
    const contaminated = { 'Heavy contamination requiring extensive cleaning': true };
    expect(asBilled(LACERATION, woundAnswers(site, lengthCm, contaminated))).toEqual([code]);
  });
});

describe('wound repair — contaminated with bone, cartilage or tendon showing', () => {
  it.each(COMPLEX_REPAIR)('%s, %s cm → %s', (site, lengthCm, codes) => {
    const complex = {
      'Heavy contamination requiring extensive cleaning': true,
      'Exposed bone/cartilage/tendon/named neurovascular structure': true,
    };
    expect(asBilled(LACERATION, woundAnswers(site, lengthCm, complex))).toEqual(codes);
  });
});

describe('an unfinished form is asked about, never guessed at', () => {
  it.each(UNFINISHED_FORMS.map((entry) => [entry.visit, entry] as const))('%s', (_name, entry) => {
    expect(asBilled(entry.procedure, entry.answers)).toEqual([]);
    expect(messages(entry.procedure, entry.answers)).toEqual(
      entry.asksFor.map((field) => `Additional documentation needed to suggest a code — ${field}`)
    );
  });
});

describe('what the provider writes in free text never changes a code', () => {
  it('ignores a narrative that contradicts the structured answers', () => {
    const wound = { Wounds: [{ Site: 'trunk', 'Length (cm)': 2, Closure: 'single layer' } as never] };
    const withNarrative = {
      ...evaluate(LACERATION, wound),
      procedureDetails: 'Complex layered repair with extensive debridement and undermining.',
    };
    expect(suggestedCodes(suggestCode(withNarrative)).map((line) => line.code)).toEqual(['12001']);
  });
});

describe('a code already on the bill is checked against the answers', () => {
  const VERDICTS = {
    supported: CodeAssessmentKind.Supported,
    'not supported': CodeAssessmentKind.Unsupported,
    'not checked': CodeAssessmentKind.NotAssessed,
  } as const;

  it.each(CODE_CHECKS.map((entry) => [entry.visit, entry] as const))('%s', (_name, entry) => {
    const billed: CptCodeRef[] = [
      {
        code: entry.billed.code,
        display: entry.billed.code,
        ...(entry.billed.units !== undefined ? { billableUnits: entry.billed.units } : {}),
        ...(entry.billed.modifiers
          ? { modifier: entry.billed.modifiers.map((code) => ({ code, display: code })) }
          : {}),
      },
    ];
    const checked = defendCodes({ ...evaluate(entry.procedure, entry.answers), cptCodes: billed });

    expect(checked.codeAssessments[entry.billed.code]).toEqual({ kind: VERDICTS[entry.verdict] });
    if (entry.because !== undefined) expect(checked.findings.map((f) => f.message)).toContain(entry.because);
  });
});

describe('billing safeguards', () => {
  it('keeps the documented quantity and warns when it passes the daily allowance', () => {
    const answers = { 'Collection type': 'abscess', 'Drainage method': 'needle', 'Distinct collections': 5 };
    expect(asBilled(DRAINAGE, answers)).toEqual(['10160 x5']);
    expect(messages(DRAINAGE, answers)).toContain(
      'Documented quantity 5 exceeds the usual daily allowance of 3. Review before billing; the quantity is unchanged.'
    );
  });

  it('reads answers saved earlier, and treats a damaged saved value as absent', () => {
    expect(parseStructuredFacts(JSON.stringify({ count: 2 }))).toEqual({ count: 2 });
    expect(parseStructuredFacts('{bad')).toBeUndefined();
    expect(parseStructuredFacts('{"count":null}')).toBeUndefined();
  });
});

describe('coverage: no code the engine can suggest is left untested', () => {
  const everyExpectedCode = new Set(
    [
      ...ALL_VISITS.flatMap((entry) => entry.suggests),
      ...SIMPLE_REPAIR.map(([, , code]) => code),
      ...INTERMEDIATE_REPAIR.map(([, , code]) => code),
      ...COMPLEX_REPAIR.flatMap(([, , codes]) => codes),
      '10160 x5',
    ].map((line) => line.split(' ')[0].split('-')[0])
  );

  it.each(PROCEDURE_FAMILIES.map((family) => [family.id, family] as const))(
    '%s — every code it can emit appears in a table above',
    (_id, family) => {
      expect(family.codes.filter((code) => !everyExpectedCode.has(code))).toEqual([]);
    }
  );

  it('covers every procedure family with at least one visit', () => {
    const covered = new Set(
      [...ALL_VISITS.map((entry) => entry.procedure), LACERATION].map((procedure) => familyFor(procedure).id)
    );
    expect(PROCEDURE_FAMILIES.map((family) => family.id).filter((id) => !covered.has(id))).toEqual([]);
  });
});
