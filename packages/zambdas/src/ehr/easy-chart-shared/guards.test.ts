// Offline unit tests for the server guards. The terminology service is faked, so these run in the
// `unit` vitest project with no network and no Auth0 secrets.

import Oystehr from '@oystehr/sdk';
import { RawAction } from 'utils/lib/easy-chart/actions';
import { describe, expect, it } from 'vitest';
import { applyGuards, GuardContext } from './guards';

const ICD10_ROWS: Record<string, { code: string; display: string }> = {
  'J02.0': { code: 'J02.0', display: 'Streptococcal pharyngitis' },
  'H66.91': { code: 'H66.91', display: 'Otitis media, unspecified, right ear' },
  'A54.5': { code: 'A54.5', display: 'Gonococcal pharyngitis' },
  'Z87.442': { code: 'Z87.442', display: 'Personal history of urinary calculi' },
  'A54.01': { code: 'A54.01', display: 'Gonococcal cystitis and urethritis, unspecified' },
  'S01.81XA': { code: 'S01.81XA', display: 'Laceration without foreign body of other part of head, initial encounter' },
};

const DESCRIPTION_ROWS: Record<string, { code: string; display: string }> = {
  'strep throat': { code: 'J02.0', display: 'Streptococcal pharyngitis' },
  'low back strain': { code: 'S39.012A', display: 'Strain of muscle of lower back, initial encounter' },
  'kidney stone': { code: 'N20.0', display: 'Calculus of kidney' },
  pharyngitis: { code: 'J02.9', display: 'Acute pharyngitis, unspecified' },
  'streptococcal pharyngitis': { code: 'J02.0', display: 'Streptococcal pharyngitis' },
  // Mirrors the live platform response that caused the miscode: an unrelated top row for a bare
  // one-word query.
  // Mirrors the live platform: an unrelated top row, then obstetric codes that share only the condition
  // word. The correct S01.81XA never appears — which is the point.
  laceration: { code: 'O70.20', display: 'Third degree perineal laceration during delivery, unspecified' },
  'laceration of left forehead': { code: 'M89.38', display: 'Hypertrophy of bone, other site' },
  'otitis media': { code: 'H66.90', display: 'Otitis media, unspecified, unspecified ear' },
};

const CPT_ROWS: Record<string, { code: string; display: string }> = {
  '99214': { code: '99214', display: 'Office visit, established patient, moderate' },
  '96372': { code: '96372', display: 'Therapeutic injection, SC/IM' },
};
const HCPCS_ROWS: Record<string, { code: string; display: string }> = {
  J1885: { code: 'J1885', display: 'Injection, ketorolac tromethamine, per 15 mg' },
};

/** A terminology service that only knows the rows above — a hallucinated code finds nothing. */
const fakeOystehr = {
  terminology: {
    // The resolution pipeline searches with searchType 'all' and pages by cursor, so one query has to be
    // able to answer as an exact code, a category prefix (sibling enumeration) or a description.
    searchIcd10: async ({ query }: { query: string }) => {
      const upper = query.trim().toUpperCase();
      const exact = ICD10_ROWS[upper];
      if (exact) return { codes: [exact], metadata: { nextCursor: null } };
      const siblings = Object.values(ICD10_ROWS).filter((row) => row.code.toUpperCase().startsWith(upper));
      if (upper.length <= 4 && siblings.length > 0) return { codes: siblings, metadata: { nextCursor: null } };
      const row = DESCRIPTION_ROWS[query.trim().toLowerCase()];
      return { codes: row ? [row] : [], metadata: { nextCursor: null } };
    },
    searchCpt: async ({ query }: { query: string }) => ({
      codes: CPT_ROWS[query] ? [CPT_ROWS[query]] : [],
      metadata: { nextCursor: null },
    }),
    searchHcpcs: async ({ query }: { query: string }) => ({
      codes: HCPCS_ROWS[query.toUpperCase()] ? [HCPCS_ROWS[query.toUpperCase()]] : [],
      metadata: { nextCursor: null },
    }),
  },
} as unknown as Oystehr;

const context = (narrative: string, chartedItems: string[] = [], extra: Partial<GuardContext> = {}): GuardContext => ({
  oystehr: fakeOystehr,
  narrative,
  chartedItems,
  logPrefix: 'test',
  ...extra,
});

const run = (
  actions: RawAction[],
  narrative: string,
  chartedItems: string[] = [],
  extra: Partial<GuardContext> = {}
): ReturnType<typeof applyGuards> => applyGuards(actions, context(narrative, chartedItems, extra));

describe('required-field gate', () => {
  it('skips an action with a reason rather than letting it be a silent no-op', async () => {
    const { actions, rejected } = await run([{ kind: 'add-diagnosis', display: '  ' }], 'sore throat');
    expect(actions).toEqual([]);
    expect(rejected[0].reason).toMatch(/did not supply display/);
  });

  it('refuses a kind this build does not know, instead of falling through to "nothing to chart"', async () => {
    const { rejected } = await run([{ kind: 'add-telepathy' } as unknown as RawAction], 'x');
    expect(rejected[0].reason).toMatch(/is not an action this build knows/);
  });
});

describe('numeric coercion (digit-loop guard undo)', () => {
  it('restores a numeric field the schema declared as a string', async () => {
    const { actions } = await run(
      [{ kind: 'set-disposition', dispositionType: 'pcp', text: 'Follow up.', followUpInDays: '7' }],
      'follow up in a week'
    );
    expect(actions[0].followUpInDays).toBe(7);
  });
});

describe('vitals', () => {
  it('converts every unit into one the chart write path handles', async () => {
    const { actions } = await run(
      [
        { kind: 'set-vital', field: 'vital-height', display: '1.73 m' },
        { kind: 'set-vital', field: 'vital-weight', display: '130lb' },
        { kind: 'set-vital', field: 'vital-blood-pressure', display: '122/78' },
      ],
      `patient is 1.73 m, weighs 130lb, BP 122/78`
    );
    expect(actions[0]).toMatchObject({ value: 173, unit: 'cm' });
    expect(actions[1]).toMatchObject({ value: 130, unit: 'lb' });
    expect(actions[2]).toMatchObject({ systolic: 122, diastolic: 78 });
  });

  // The regression that motivates one endpoint returning 1..N actions.
  it(`charts BOTH readings in "patient is 5'8\\", weighs 130lb"`, async () => {
    const narrative = `patient is 5'8", weighs 130lb`;
    const { actions, rejected } = await run(
      [
        { kind: 'set-vital', field: 'vital-height', display: `5'8"` },
        { kind: 'set-vital', field: 'vital-weight', display: '130lb' },
      ],
      narrative
    );
    expect(rejected).toEqual([]);
    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({ value: 68, unit: 'in' });
  });

  // The model emits a set-vital with no display at all; the number is sitting in the message.
  it('recovers a reading the model dropped, for a non-blood-pressure vital', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'set-vital', field: 'vital-height' }],
      'add height 34 inches please'
    );
    expect(rejected).toEqual([]);
    expect(actions[0]).toMatchObject({ display: '34 inches', value: 34, unit: 'in' });
  });

  it('asks rather than charting or reinterpreting an implausible height', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'set-vital', field: 'vital-height', display: '5.8 inches' }],
      'add height 5.8 inches'
    );
    expect(actions).toEqual([]);
    expect(rejected[0].reason).toMatch(/live-birth/);
  });

  it('reports an unrecognised unit instead of defaulting', async () => {
    const { rejected } = await run(
      [{ kind: 'set-vital', field: 'vital-weight', display: '5 bananas' }],
      'weighs 5 bananas'
    );
    expect(rejected[0].reason).toMatch(/not a weight unit/);
  });
});

describe('diagnosis codes', () => {
  it('takes code and display from ONE terminology row', async () => {
    const { actions } = await run(
      [{ kind: 'add-diagnosis', display: 'Strep throat', code: 'J02.0', isPrimary: true }],
      'rapid strep positive'
    );
    expect(actions[0]).toMatchObject({ code: 'J02.0', display: 'Streptococcal pharyngitis' });
  });

  it('falls back to a description search when the code is hallucinated, and never pairs the two', async () => {
    const { actions } = await run(
      [{ kind: 'add-diagnosis', display: 'Strep throat', code: 'X99.999', isPrimary: true }],
      'rapid strep positive'
    );
    expect(actions[0]).toMatchObject({ code: 'J02.0', display: 'Streptococcal pharyngitis' });
  });

  it('refuses a diagnosis no terminology row supports rather than charting the model text', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-diagnosis', display: 'Spontaneous combustion', code: 'Q99.9', isPrimary: true }],
      'patient combusted'
    );
    expect(actions).toEqual([]);
    expect(rejected[0].reason).toMatch(/no ICD-10 code could be confirmed/);
  });

  // REPAIR BEFORE REFUSING. The condition is right and only the qualifier is wrong, so the guard
  // re-searches with the unsupported qualifier stripped and the SUPPORTED one substituted — the evidence
  // says strep, so gonococcal pharyngitis becomes streptococcal pharyngitis instead of being dropped.
  it('repairs an organism qualifier the visit contradicts, using the qualifier it does support', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-diagnosis', display: 'Pharyngitis', code: 'A54.5', isPrimary: true }],
      'two days of sore throat, rapid strep positive'
    );
    expect(rejected).toEqual([]);
    expect(actions[0]).toMatchObject({ code: 'J02.0', display: 'Streptococcal pharyngitis' });
  });

  // The other half of the same guard: when stripping the qualifier leaves a condition the terminology
  // cannot match, there is nothing clean to chart and the action is refused rather than guessed at.
  it('refuses the qualifier outright when no clean replacement exists', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-diagnosis', display: 'Gonococcal urethritis', code: 'A54.01', isPrimary: true }],
      'ear pain for two days, no genitourinary symptoms at all'
    );
    expect(actions).toEqual([]);
    expect(rejected[0].reason).toMatch(/gonococcal|no ICD-10 code could be confirmed/);
  });

  it('allows the organism qualifier when the visit does support it', async () => {
    const { actions } = await run(
      [{ kind: 'add-diagnosis', display: 'Pharyngitis', code: 'A54.5', isPrimary: true }],
      'gonorrhea exposure, pharyngeal swab positive'
    );
    expect(actions[0].code).toBe('A54.5');
  });

  // A history-of hint is now DISCARDED rather than fatal: the condition the provider named is usually
  // right and only the code is wrong, so the display search gets to pick again. Charting the real code
  // beats refusing the diagnosis, and refusing still happens when the search has nothing to offer.
  it('discards a history-of Z-code hint for a current problem and charts the real code', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-diagnosis', display: 'Kidney stone', code: 'Z87.442', isPrimary: true }],
      'sudden onset of severe right flank pain that started four hours ago'
    );
    expect(rejected).toEqual([]);
    expect(actions[0]).toMatchObject({ code: 'N20.0', display: 'Calculus of kidney' });
  });

  it('refuses the diagnosis when the hint is a history code and nothing else resolves', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-diagnosis', display: 'Prior urinary calculi', code: 'Z87.442', isPrimary: true }],
      'sudden onset of severe right flank pain'
    );
    expect(actions).toEqual([]);
    expect(rejected[0].reason).toMatch(/no ICD-10 code could be confirmed/);
  });

  it('drops a duplicate and demotes a second primary rather than losing the diagnosis', async () => {
    const { actions, rejected } = await run(
      [
        { kind: 'add-diagnosis', display: 'Strep throat', code: 'J02.0', isPrimary: true },
        { kind: 'add-diagnosis', display: 'Strep throat', code: 'J02.0', isPrimary: true },
        { kind: 'add-diagnosis', display: 'Low back strain', code: 'S39.012A', isPrimary: true },
      ],
      'rapid strep positive; also low back strain'
    );
    expect(rejected.some((r) => /already charted in this plan/.test(r.reason))).toBe(true);
    expect(actions.filter((a) => a.isPrimary)).toHaveLength(1);
    expect(actions).toHaveLength(2);
    expect(actions[1].caution).toMatch(/charted as secondary/);
  });
});

describe('billing codes', () => {
  it('confirms an E&M code and a HCPCS J-code against the terminology service', async () => {
    const { actions, rejected } = await run(
      [
        { kind: 'set-em-code', code: '99214' },
        { kind: 'add-cpt', code: 'J1885' },
      ],
      'gave a Toradol shot'
    );
    expect(rejected).toEqual([]);
    expect(actions[0].display).toBe('Office visit, established patient, moderate');
    expect(actions[1].display).toMatch(/ketorolac/);
  });

  it('drops a CPT that is not real', async () => {
    const { rejected } = await run([{ kind: 'add-cpt', code: '11111' }], 'did a thing');
    expect(rejected[0].reason).toMatch(/not a real CPT/);
  });
});

describe('exam and ROS polarity', () => {
  // "No wheezing" must neither create a wheezing finding nor remove the matching normal.
  it('refuses to chart a negated finding as an abnormality', async () => {
    const { actions, rejected } = await run([{ kind: 'add-exam-finding', display: 'No wheezing' }], 'no wheezing');
    expect(actions).toEqual([]);
    expect(rejected[0].reason).toMatch(/positive observations only/);
  });

  it('refuses to remove a normal on the strength of a negative that agrees with it', async () => {
    const { rejected } = await run(
      [{ kind: 'remove-exam-finding', display: 'no signs of respiratory distress' }],
      'lungs clear, no respiratory distress',
      ['No signs of respiratory distress']
    );
    expect(rejected[0].reason).toMatch(/agrees with the charted normal/);
  });

  it('keeps a genuine abnormality', async () => {
    const { actions } = await run(
      [{ kind: 'add-exam-finding', display: 'Right TM erythematous and bulging' }],
      'right TM erythematous and bulging'
    );
    expect(actions).toHaveLength(1);
  });

  it('records the ROS polarity from the display verb', async () => {
    const { actions } = await run([{ kind: 'add-ros-finding', display: 'Denies chest pain' }], 'denies chest pain');
    expect(actions[0].finding).toBe('denies');
  });

  it('refuses a ROS finding with no polarity rather than guessing one', async () => {
    const { rejected } = await run([{ kind: 'add-ros-finding', display: 'chest pain' }], 'chest pain');
    expect(rejected[0].reason).toMatch(/reports or denies/);
  });
});

describe('removals', () => {
  it('refuses a removal when the chart is empty', async () => {
    const { rejected } = await run([{ kind: 'remove-medication', display: 'Motrin' }], 'remove Motrin');
    expect(rejected[0].reason).toMatch(/chart is empty/);
  });

  it('refuses a removal that matches nothing on the chart', async () => {
    const { rejected } = await run([{ kind: 'remove-medication', display: 'Motrin' }], 'remove Motrin', [
      'Amoxicillin 400 mg/5 mL',
    ]);
    expect(rejected[0].reason).toMatch(/is not on the chart/);
  });

  it('allows a removal that matches a charted item', async () => {
    const { actions, rejected } = await run([{ kind: 'remove-medication', display: 'Motrin' }], 'remove Motrin', [
      'Motrin 200 mg tablet',
    ]);
    expect(rejected).toEqual([]);
    expect(actions).toHaveLength(1);
  });
});

describe('provenance', () => {
  const narrative = 'Rapid strep antigen was positive. Will start amoxicillin.';

  it('keeps a quote the narrative really contains', async () => {
    const { actions } = await run(
      [
        {
          kind: 'add-diagnosis',
          display: 'Strep throat',
          code: 'J02.0',
          sourceText: 'Rapid strep antigen was positive',
        },
      ],
      narrative
    );
    expect(actions[0].sourceText).toBe('Rapid strep antigen was positive');
  });

  // A fabricated citation in a medical record is worse than none: the item becomes honestly inferred.
  it('drops a fabricated quote so the item is marked inferred', async () => {
    const { actions } = await run(
      [{ kind: 'add-diagnosis', display: 'Strep throat', code: 'J02.0', sourceText: 'the culture grew group A strep' }],
      narrative
    );
    expect(actions[0].sourceText).toBeUndefined();
  });
});

describe('deterministic triggers', () => {
  // Report BOTH whether the trigger fired and whether the model complied — otherwise "the guard never
  // fired" and "the guard fired and was ignored" look identical.
  it('reports a fired-but-ignored disposition trigger', async () => {
    const { triggers } = await run(
      [{ kind: 'set-em-code', code: '99214' }],
      'Follow up with primary care in one to two weeks if not improving.'
    );
    const disposition = triggers.find((t) => t.trigger === 'disposition-language-without-disposition');
    expect(disposition).toEqual({
      trigger: 'disposition-language-without-disposition',
      fired: true,
      complied: false,
    });
  });

  it('reports compliance when the disposition was charted', async () => {
    const { triggers } = await run(
      [
        { kind: 'set-em-code', code: '99214' },
        { kind: 'set-disposition', dispositionType: 'pcp', text: 'Follow up with PCP.' },
      ],
      'Follow up with primary care in one to two weeks.'
    );
    expect(triggers.find((t) => t.trigger === 'disposition-language-without-disposition')?.complied).toBe(true);
  });

  it('reports a voiced prescription commitment that produced neither a med nor a note', async () => {
    const { triggers } = await run([{ kind: 'set-em-code', code: '99214' }], "I'll send you something for the cough.");
    expect(triggers.find((t) => t.trigger === 'voiced-prescription-commitment')).toMatchObject({
      fired: true,
      complied: false,
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Restored invariants and backstops
// ---------------------------------------------------------------------------------------------

describe('exactly-one-primary invariant', () => {
  // Measured on the harvested corpus: 0 of 13 add-diagnosis actions carried isPrimary, so every note
  // came out with no primary diagnosis. The prompt asks for one and the model does not comply, and the
  // response schema cannot require it per-kind, so promotion has to be deterministic.
  it('promotes the first diagnosis when the plan marked none', async () => {
    const { actions } = await run(
      [
        { kind: 'add-diagnosis', display: 'Strep throat' },
        { kind: 'add-diagnosis', display: 'Otitis media' },
      ],
      'rapid strep positive, and the right ear looks infected',
      [],
      { promoteMissingPrimary: true }
    );
    expect(actions.filter((a) => a.kind === 'add-diagnosis' && a.isPrimary)).toHaveLength(1);
    expect(actions[0]).toMatchObject({ code: 'J02.0', isPrimary: true });
    expect(actions[0].caution).toMatch(/no primary diagnosis was marked/);
  });

  it('leaves an explicitly marked primary alone', async () => {
    const { actions } = await run(
      [
        { kind: 'add-diagnosis', display: 'Strep throat' },
        { kind: 'add-diagnosis', display: 'Otitis media', isPrimary: true },
      ],
      'rapid strep positive, and the right ear looks infected',
      [],
      { promoteMissingPrimary: true }
    );
    expect(actions.find((a) => a.isPrimary)).toMatchObject({ code: 'H66.90' });
    expect(actions[0].caution).toBeUndefined();
  });

  // The review surface is guarded one suggestion at a time, and its secondary-dx card deliberately adds
  // a single diagnosis with no primary claim. Promoting there would silently change the note's primary.
  it('does NOT promote when the caller did not ask for it (the review surface)', async () => {
    const { actions } = await run([{ kind: 'add-diagnosis', display: 'Otitis media' }], 'the right ear looks infected');
    expect(actions[0].isPrimary).toBeUndefined();
  });

  it('never usurps an existing primary on an incremental turn', async () => {
    const { actions } = await run(
      [{ kind: 'add-diagnosis', display: 'Otitis media' }],
      'also the right ear looks infected',
      ['Diagnoses: Streptococcal pharyngitis (primary)'],
      { promoteMissingPrimary: true, incremental: true }
    );
    expect(actions[0].isPrimary).toBe(false);
  });
});

describe('speaker-label refusal', () => {
  // "DOCTOR X31" matches the ICD-10 shape, and a code sniffer once charted it as a diagnosis.
  it('refuses a transcript speaker tag as a diagnosis code', async () => {
    const narrative =
      'DOCTOR X31: the throat looks red.\nPATIENT X31: it hurts.\nDOCTOR X31: rapid strep positive, so strep throat.';
    const { actions } = await run([{ kind: 'add-diagnosis', display: 'Strep throat', code: 'X31' }], narrative);
    expect(actions[0].code).toBe('J02.0');
  });
});

describe('deterministic backstops', () => {
  it('appends a dictated vital the plan omitted, flagged with where it came from', async () => {
    const { actions } = await run(
      [{ kind: 'set-vital', field: 'vital-blood-pressure', display: '186/104' }],
      'Blood pressure was 186 over 104. A repeat manual blood pressure dropped slightly to 176 over 92.'
    );
    const pressures = actions.filter((a) => a.kind === 'set-vital');
    expect(pressures).toHaveLength(2);
    expect(pressures[1]).toMatchObject({ systolic: 176, diastolic: 92 });
    // NUMBERS. The backstops run after coerceNumericFields, so a stringified reading here would reach
    // the chart write uncoerced.
    expect(typeof pressures[1].systolic).toBe('number');
    expect(pressures[1].caution).toMatch(/recovered from the dictation/);
  });

  it('does not duplicate a reading the plan already charted', async () => {
    const { actions } = await run(
      [{ kind: 'set-vital', field: 'vital-heartbeat', display: '115' }],
      'She is slightly tachycardic at a heart rate of 115.'
    );
    expect(actions.filter((a) => a.kind === 'set-vital')).toHaveLength(1);
  });

  it('converts an order for a test the narrative reports as already performed into a note', async () => {
    const { actions } = await run(
      [{ kind: 'add-in-house-lab', display: 'Rapid strep' }],
      'The rapid strep test was performed in clinic and came back positive.'
    );
    expect(actions[0].kind).toBe('provider-note');
    expect(actions[0].text).toMatch(/already performed/);
  });

  it('leaves a genuine future order alone', async () => {
    const { actions } = await run(
      [{ kind: 'add-external-lab', display: 'Urine culture' }],
      'We will send the urine out for culture.'
    );
    expect(actions[0].kind).toBe('add-external-lab');
  });

  it('reminds the provider that a charted medication is not a transmitted prescription', async () => {
    const { actions } = await run(
      [{ kind: 'add-medication', display: 'Amoxicillin', strength: '500 mg' }],
      "I'll send the prescription to your pharmacy."
    );
    expect(actions.some((a) => a.kind === 'provider-note' && /eRx/.test(a.text ?? ''))).toBe(true);
  });

  it('strips numeric junk the model attaches to steps that have no reading', async () => {
    const { actions } = await run(
      [{ kind: 'add-patient-instruction', text: 'Rest and fluids.', value: '0.0012' } as unknown as RawAction],
      'rest and fluids'
    );
    expect(actions[0]).not.toHaveProperty('value');
  });
});

describe('billing-code lookup failure modes', () => {
  /** Same fake, except the CPT/HCPCS endpoints are down. */
  const outageContext = (narrative: string): GuardContext => ({
    oystehr: {
      ...(fakeOystehr as unknown as Record<string, unknown>),
      terminology: {
        ...(fakeOystehr.terminology as unknown as Record<string, unknown>),
        searchCpt: async () => {
          throw new Error('terminology unavailable');
        },
        searchHcpcs: async () => {
          throw new Error('terminology unavailable');
        },
      },
    } as unknown as Oystehr,
    narrative,
    chartedItems: [],
    logPrefix: 'test',
  });

  // "The service says this code is not real" and "the service is down" must not behave alike. Collapsing
  // them strips billing from every visit for the length of an outage, and nobody notices until the
  // invoices are short.
  it('keeps the model E&M code when terminology is unreachable', async () => {
    const { actions, rejected } = await applyGuards(
      [{ kind: 'set-em-code', code: '99214', display: 'Level 4 established' }],
      outageContext('moderate complexity visit')
    );
    expect(rejected).toEqual([]);
    expect(actions[0].code).toBe('99214');
  });

  it('still drops a code the service answered about and does not know', async () => {
    const { actions, rejected } = await run([{ kind: 'set-em-code', code: '99999' }], 'visit');
    expect(actions).toEqual([]);
    expect(rejected[0].reason).toMatch(/not a real CPT code/);
  });

  it('keeps an unreachable-service HCPCS code rather than losing the charge', async () => {
    const { actions, rejected } = await applyGuards(
      [{ kind: 'add-cpt', code: 'J1885', display: 'Ketorolac' }],
      outageContext('ketorolac 30 mg IM given in clinic')
    );
    expect(rejected).toEqual([]);
    expect(actions[0].code).toBe('J1885');
  });
});

describe('field leaks between action kinds', () => {
  // A real plan: the model named an unrelated condition in `code` and put the code it actually meant
  // inside `updates` — update-procedure's shape — on an add-diagnosis. A field the executor does not read
  // for this kind can only mislead whoever reads the plan; one it reads under another kind can change
  // what gets charted.
  it('strips a field the action kind does not declare', async () => {
    const { actions } = await run(
      [
        {
          kind: 'add-diagnosis',
          display: 'Strep throat',
          updates: [{ field: 'code', value: 'S01.81XA' }],
          strength: 'true',
        } as unknown as RawAction,
      ],
      'rapid strep positive'
    );
    expect(actions[0]).not.toHaveProperty('updates');
    expect(actions[0]).not.toHaveProperty('strength');
    expect(actions[0].code).toBe('J02.0');
  });

  it('keeps the fields the kind does declare', async () => {
    const { actions } = await run(
      [{ kind: 'add-medication', display: 'Amoxicillin', strength: '500 mg', doseForm: 'capsule' }],
      'amoxicillin 500 mg capsules'
    );
    expect(actions[0]).toMatchObject({ strength: '500 mg', doseForm: 'capsule' });
  });
});

describe('unrelated search results', () => {
  // Searching "laceration" for a forehead laceration returned "Hypertrophy of bone, other site" (M89.38)
  // as its top row. No contradiction predicate objected — an unrelated condition contradicts nothing —
  // and that is what got charted for a 9-year-old's scooter injury.
  it('refuses a top search row that names nothing the intent named', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-diagnosis', display: 'Laceration of left forehead', searchTerms: ['laceration'] }],
      'two centimeter linear laceration above the left eyebrow'
    );
    expect(actions).toEqual([]);
    expect(rejected[0].reason).toMatch(/no ICD-10 code could be confirmed/);
  });
});

describe('care-context and code salvage', () => {
  // The terminology search cannot reach the S-chapter from a description: querying a forehead laceration
  // returns obstetric and birth-injury codes that share the condition word and contradict no anatomy the
  // guard knows. They assert a care setting the visit does not describe, which is what refuses them.
  it('refuses an obstetric code for an injury the visit describes plainly', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-diagnosis', display: 'Laceration of left forehead', searchTerms: ['laceration'] }],
      'nine-year-old fell off his scooter, two centimeter linear laceration above the left eyebrow'
    );
    expect(actions).toEqual([]);
    expect(rejected).toHaveLength(1);
  });

  // The model knew the right code and put it in update-procedure's `updates` field. Code lookup is the
  // reliable path, so the salvaged value is fed to it as a candidate — and confirmed, not trusted.
  it('salvages a code-shaped value from a misplaced field and confirms it', async () => {
    const { actions, rejected } = await run(
      [
        {
          kind: 'add-diagnosis',
          display: 'Laceration of left forehead',
          updates: [{ field: 'code', value: 'S01.81XA' }],
        } as unknown as RawAction,
      ],
      'two centimeter linear laceration above the left eyebrow'
    );
    expect(rejected).toEqual([]);
    expect(actions[0]).toMatchObject({ code: 'S01.81XA' });
    expect(actions[0]).not.toHaveProperty('updates');
  });
});

describe('backstop-appended vitals carry numbers', () => {
  // The response schema declares every numeric field as a string (the digit-loop guard) and guardOne
  // coerces them back. The backstops append actions AFTER that, so anything numeric they add has to be a
  // number already — nothing downstream will convert it.
  it('appends a swept reading as a number, not a string', async () => {
    const { actions } = await run([], 'Oxygen saturation was 94 percent on room air.');
    const sweep = actions.find((a) => a.kind === 'set-vital');
    expect(sweep).toBeDefined();
    expect(typeof sweep!.value).toBe('number');
    expect(sweep!.value).toBe(94);
  });
});
