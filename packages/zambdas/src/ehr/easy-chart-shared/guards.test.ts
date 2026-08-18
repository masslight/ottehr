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
};

const DESCRIPTION_ROWS: Record<string, { code: string; display: string }> = {
  'strep throat': { code: 'J02.0', display: 'Streptococcal pharyngitis' },
  'low back strain': { code: 'S39.012A', display: 'Strain of muscle of lower back, initial encounter' },
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
    searchIcd10: async ({ query, searchType }: { query: string; searchType?: string }) => {
      const row = searchType === 'code' ? ICD10_ROWS[query.toUpperCase()] : DESCRIPTION_ROWS[query.toLowerCase()];
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

const context = (narrative: string, chartedItems: string[] = []): GuardContext => ({
  oystehr: fakeOystehr,
  narrative,
  chartedItems,
  logPrefix: 'test',
});

const run = (actions: RawAction[], narrative: string, chartedItems: string[] = []): ReturnType<typeof applyGuards> =>
  applyGuards(actions, context(narrative, chartedItems));

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

  it('refuses an organism qualifier the visit does not support', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-diagnosis', display: 'Pharyngitis', code: 'A54.5', isPrimary: true }],
      'two days of sore throat, rapid strep positive'
    );
    expect(actions).toEqual([]);
    expect(rejected[0].reason).toMatch(/gonococcal/);
  });

  it('allows the organism qualifier when the visit does support it', async () => {
    const { actions } = await run(
      [{ kind: 'add-diagnosis', display: 'Pharyngitis', code: 'A54.5', isPrimary: true }],
      'gonorrhea exposure, pharyngeal swab positive'
    );
    expect(actions[0].code).toBe('A54.5');
  });

  it('refuses a history-of Z-code for a current problem', async () => {
    const { rejected } = await run(
      [{ kind: 'add-diagnosis', display: 'Kidney stone', code: 'Z87.442', isPrimary: true }],
      'sudden onset of severe right flank pain that started four hours ago'
    );
    expect(rejected[0].reason).toMatch(/personal-history code/);
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
