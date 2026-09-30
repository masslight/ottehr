import Oystehr from '@oystehr/sdk';
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
  // Mirrors the live platform: unrelated rows for a bare "laceration", never the correct S01.81XA.
  laceration: { code: 'O70.20', display: 'Third degree perineal laceration during delivery, unspecified' },
  'laceration of left forehead': { code: 'M89.38', display: 'Hypertrophy of bone, other site' },
  'otitis media': { code: 'H66.90', display: 'Otitis media, unspecified, unspecified ear' },
};

const CPT_ROWS: Record<string, { code: string; display: string }> = {
  '99214': { code: '99214', display: 'Office visit, established patient, moderate' },
};

/** A terminology service that only knows the rows above — a hallucinated code finds nothing. */
const fakeOystehr = {
  terminology: {
    // One query answers as an exact code, a category prefix (sibling enumeration) or a description.
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
  },
} as unknown as Oystehr;

const context = (narrative: string, extra: Partial<GuardContext> = {}): GuardContext => ({
  oystehr: fakeOystehr,
  narrative,
  logPrefix: 'test',
  ...extra,
});

const run = (
  actions: unknown[],
  narrative: string,
  extra: Partial<GuardContext> = {}
): ReturnType<typeof applyGuards> => applyGuards(actions, context(narrative, extra));

describe('required-field gate', () => {
  it('skips an action with a reason rather than letting it be a silent no-op', async () => {
    const { actions, rejected } = await run([{ kind: 'add-diagnosis', display: '  ' }], 'sore throat');
    expect(actions).toEqual([]);
    expect(rejected[0].reason).toMatch(/did not supply display/);
  });

  it('refuses a kind this build does not know, instead of falling through to "nothing to chart"', async () => {
    const { rejected } = await run([{ kind: 'add-telepathy' }], 'x');
    expect(rejected[0].reason).toMatch(/is not an action this build knows/);
  });

  // The backup model decodes without the schema, so the registry shape is checked on the server.
  it('refuses a required value the chart does not accept, instead of writing it under a wrong key', async () => {
    const { actions, rejected } = await run([{ kind: 'edit-note-text', field: 'hpi', newText: 'Sore throat.' }], 'x');
    expect(actions).toEqual([]);
    expect(rejected[0].reason).toBe('field "hpi" is not something the chart accepts');
  });

  it('drops an optional value the chart does not accept and keeps the action', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-ros-finding', display: 'Denies fever', finding: 'negative' }],
      'denies fever'
    );
    expect(rejected).toEqual([]);
    expect(actions[0]).toMatchObject({ kind: 'add-ros-finding', display: 'Denies fever', finding: 'denies' });
  });

  it('reports a malformed item instead of failing the whole answer', async () => {
    const { actions, rejected } = await run(
      ['add-diagnosis', null, { display: 'no kind' }, { kind: 'add-patient-instruction', text: 'Rest.' }],
      'rest'
    );
    expect(rejected.filter((item) => /malformed/.test(item.reason))).toHaveLength(3);
    expect(actions.map((action) => action.kind)).toEqual(['add-patient-instruction']);
  });
});

describe('model output normalization', () => {
  it('strips wrapping quotes and padding, and accepts "true" and a lone search term', async () => {
    const { actions } = await run(
      [
        {
          kind: ' Add-Diagnosis ',
          display: '"Strep throat"',
          code: " 'J02.0' ",
          isPrimary: 'true',
          searchTerms: 'strep throat',
        },
      ],
      'rapid strep positive'
    );
    expect(actions[0]).toMatchObject({ kind: 'add-diagnosis', code: 'J02.0', isPrimary: true });
  });

  it('keeps inner quotes that are part of the value', async () => {
    const { actions } = await run(
      [{ kind: 'add-patient-instruction', text: '"Rest" and "fluids"' }],
      'rest and fluids'
    );
    expect(actions[0].text).toBe('"Rest" and "fluids"');
  });

  it('reads the code out of a decorated ICD-10 or E&M value', async () => {
    const { actions, rejected } = await run(
      [
        { kind: 'add-diagnosis', display: 'Strep throat', code: 'ICD-10: j02.0', isPrimary: true },
        { kind: 'set-em-code', code: '99214 (moderate complexity)' },
      ],
      'rapid strep positive'
    );
    expect(rejected).toEqual([]);
    expect(actions.map((action) => action.code)).toEqual(['J02.0', '99214']);
  });

  it('drops a wrongly typed field so the required-field gate reports it', async () => {
    const { rejected } = await run([{ kind: 'add-allergy', display: 42 }], 'penicillin allergy');
    expect(rejected[0].reason).toMatch(/did not supply display/);
  });
});

describe('numeric coercion (digit-loop guard undo)', () => {
  it('restores a numeric field the schema declared as a string', async () => {
    const { actions } = await run(
      [{ kind: 'set-disposition', dispositionType: 'pcp-no-type', text: 'Follow up.', followUpInDays: '7' }],
      'follow up in a week'
    );
    expect(actions[0].followUpInDays).toBe(7);
  });
});

describe('disposition', () => {
  it('refuses a type the chart has no tab for', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'set-disposition', dispositionType: 'ip', text: 'Admitted to the hospital.' }],
      'we are admitting her'
    );
    expect(actions).toEqual([]);
    expect(rejected[0].reason).toBe('dispositionType "ip" is not something the chart accepts');
  });

  it('keeps an interval the card offers and drops one it cannot show, with a caution', async () => {
    const { actions } = await run(
      [
        { kind: 'set-disposition', dispositionType: 'pcp-no-type', text: 'Follow up in a week.', followUpInDays: '7' },
        { kind: 'set-disposition', dispositionType: 'specialty', text: 'See ortho in 10 days.', followUpInDays: '10' },
        { kind: 'set-disposition', dispositionType: 'ed', text: 'Go to the ER tonight.', followUpInDays: '1' },
      ],
      'follow up in a week, ortho in 10 days, ER tonight'
    );
    expect(actions.map((action) => action.followUpInDays)).toEqual([7, undefined, undefined]);
    expect(actions[1].caution).toMatch(/no follow-up option for that interval/);
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

  it('drops an exact repeat of a reading but keeps a genuine recheck', async () => {
    const { actions, rejected } = await run(
      [
        { kind: 'set-vital', field: 'vital-temperature', display: '98.9 F' },
        { kind: 'set-vital', field: 'vital-temperature', display: '98.9°F' },
        { kind: 'set-vital', field: 'vital-temperature', display: '101.2 F' },
        { kind: 'set-vital', field: 'vital-weight', display: '130lb' },
        { kind: 'set-vital', field: 'vital-weight', display: '130 lbs' },
        { kind: 'set-vital', field: 'vital-blood-pressure', display: '122/78' },
        { kind: 'set-vital', field: 'vital-blood-pressure', display: '122 over 78' },
      ],
      'temp 98.9, recheck 101.2, weighs 130 lb, bp 122/78'
    );
    expect(rejected).toEqual([]);
    expect(actions.map((a) => a.display)).toEqual(['98.9 F', '101.2 F', '130lb', '122/78']);
  });

  // The schema makes display required, so the primary model sends a dropped reading as a blank string.
  it.each([{}, { display: '' }, { display: '  ' }])(
    'recovers a reading the model dropped, for a non-blood-pressure vital (%o)',
    async (reading) => {
      const { actions, rejected } = await run(
        [{ kind: 'set-vital', field: 'vital-height', ...reading }],
        'add height 34 inches please'
      );
      expect(rejected).toEqual([]);
      expect(actions[0]).toMatchObject({ display: '34 inches', value: 34, unit: 'in' });
    }
  );

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

  it('repairs an organism qualifier the visit contradicts, using the qualifier it does support', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-diagnosis', display: 'Pharyngitis', code: 'A54.5', isPrimary: true }],
      'two days of sore throat, rapid strep positive'
    );
    expect(rejected).toEqual([]);
    expect(actions[0]).toMatchObject({ code: 'J02.0', display: 'Streptococcal pharyngitis' });
  });

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
  it('confirms an E&M code against the terminology service', async () => {
    const { actions, rejected } = await run([{ kind: 'set-em-code', code: '99214' }], 'moderate complexity');
    expect(rejected).toEqual([]);
    expect(actions[0].display).toBe('Office visit, established patient, moderate');
  });
});

describe('exam and ROS polarity', () => {
  it('charts a normal the provider voiced', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-exam-finding', display: 'Lungs clear bilaterally', sourceText: 'lungs clear bilaterally' }],
      'Chest: lungs clear bilaterally, no distress.'
    );
    expect(rejected).toEqual([]);
    expect(actions).toHaveLength(1);
    expect(actions[0].sourceOrigin).toBe('narrative');
  });

  it('charts a voiced negation as the normal it asserts', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-exam-finding', display: 'No wheezing', sourceText: 'no wheezing' }],
      'Lungs: no wheezing, good air movement.'
    );
    expect(rejected).toEqual([]);
    expect(actions).toHaveLength(1);
  });

  it('refuses a normal nobody voiced', async () => {
    const { actions, rejected } = await run(
      [
        { kind: 'add-exam-finding', display: 'Nontender' },
        { kind: 'add-exam-finding', display: 'No wheezing', sourceText: 'lungs are totally fine' },
      ],
      'Sore throat, otherwise well.'
    );
    expect(actions).toEqual([]);
    expect(rejected).toHaveLength(2);
    for (const item of rejected) expect(item.reason).toMatch(/is a normal finding nobody voiced/);
  });

  it('does not count a chart-state quote as the provider voicing a normal', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-exam-finding', display: 'Nontender', sourceText: 'Exam: Nontender' }],
      'Sore throat, otherwise well.',
      { chartStateText: '- Exam: Nontender' }
    );
    expect(actions).toEqual([]);
    expect(rejected[0].reason).toMatch(/nobody voiced/);
  });

  it('accepts a normal voiced only in the edited read-back', async () => {
    const { actions } = await run(
      [{ kind: 'add-exam-finding', display: 'Nontender', sourceText: 'abdomen soft and nontender' }],
      'Sore throat, otherwise well.',
      { editedNarrative: 'Sore throat. Abdomen soft and nontender.' }
    );
    expect(actions).toHaveLength(1);
    expect(actions[0].sourceOrigin).toBe('edited-narrative');
  });

  it('keeps a genuine abnormality, quote or no quote', async () => {
    const { actions } = await run(
      [{ kind: 'add-exam-finding', display: 'Right TM erythematous and bulging' }],
      'right TM erythematous and bulging'
    );
    expect(actions).toHaveLength(1);
    expect(actions[0].sourceOrigin).toBeUndefined();
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

  it('drops a fabricated quote so the item is marked inferred', async () => {
    const { actions } = await run(
      [{ kind: 'add-diagnosis', display: 'Strep throat', code: 'J02.0', sourceText: 'the culture grew group A strep' }],
      narrative
    );
    expect(actions[0].sourceText).toBeUndefined();
  });
});

describe('deterministic triggers', () => {
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
      matchedPattern: 'follow-up',
    });
  });

  it('reports compliance when the disposition was charted', async () => {
    const { triggers } = await run(
      [
        { kind: 'set-em-code', code: '99214' },
        { kind: 'set-disposition', dispositionType: 'pcp-no-type', text: 'Follow up with PCP.' },
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

describe('exactly-one-primary invariant', () => {
  it('promotes the first diagnosis when the plan marked none', async () => {
    const { actions } = await run(
      [
        { kind: 'add-diagnosis', display: 'Strep throat' },
        { kind: 'add-diagnosis', display: 'Otitis media' },
      ],
      'rapid strep positive, and the right ear looks infected'
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
      'rapid strep positive, and the right ear looks infected'
    );
    expect(actions.find((a) => a.isPrimary)).toMatchObject({ code: 'H66.90' });
    expect(actions[0].caution).toBeUndefined();
  });
});

describe('speaker-label refusal', () => {
  it('refuses a transcript speaker tag as a diagnosis code', async () => {
    const narrative =
      'DOCTOR X31: the throat looks red.\nPATIENT X31: it hurts.\nDOCTOR X31: rapid strep positive, so strep throat.';
    const { actions } = await run([{ kind: 'add-diagnosis', display: 'Strep throat', code: 'X31' }], narrative);
    expect(actions[0].code).toBe('J02.0');
  });
});

describe('deterministic backstops', () => {
  it('appends a dictated vital the plan omitted, flagged with where it came from', async () => {
    const dictation =
      'Blood pressure was 186 over 104. A repeat manual blood pressure dropped slightly to 176 over 92.';
    const { actions } = await run(
      [{ kind: 'set-vital', field: 'vital-blood-pressure', display: '186/104' }],
      'transcript',
      { dictation }
    );
    const pressures = actions.filter((a) => a.kind === 'set-vital');
    expect(pressures).toHaveLength(2);
    expect(pressures[1]).toMatchObject({ systolic: 176, diastolic: 92 });
    expect(typeof pressures[1].systolic).toBe('number');
    expect(pressures[1].caution).toMatch(/recovered from the dictation/);
    expect(pressures[1].sourceOrigin).toBe('edited-narrative');
  });

  // A transcript also holds home readings, other people's vitals and return thresholds.
  it('never recovers a reading from the transcript itself', async () => {
    const { actions } = await run([], 'Her temp at home was 102. Call us if her temp is over 102.');
    expect(actions.filter((a) => a.kind === 'set-vital')).toEqual([]);
  });

  it('does not duplicate a reading the plan already charted', async () => {
    const dictation = 'She is slightly tachycardic at a heart rate of 115.';
    const { actions } = await run([{ kind: 'set-vital', field: 'vital-heartbeat', display: '115' }], dictation, {
      dictation,
    });
    expect(actions.filter((a) => a.kind === 'set-vital')).toHaveLength(1);
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
      [{ kind: 'add-patient-instruction', text: 'Rest and fluids.', value: '0.0012' }],
      'rest and fluids'
    );
    expect(actions[0]).not.toHaveProperty('value');
  });
});

describe('billing-code lookup failure modes', () => {
  /** Same fake, except the CPT endpoint is down. */
  const outageContext = (narrative: string): GuardContext => ({
    oystehr: {
      ...(fakeOystehr as unknown as Record<string, unknown>),
      terminology: {
        ...(fakeOystehr.terminology as unknown as Record<string, unknown>),
        searchCpt: async () => {
          throw new Error('terminology unavailable');
        },
      },
    } as unknown as Oystehr,
    narrative,
    logPrefix: 'test',
  });

  // An outage must not strip billing from every visit while it lasts.
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
});

describe('field leaks between action kinds', () => {
  it('strips a field the action kind does not declare', async () => {
    const { actions } = await run(
      [
        {
          kind: 'add-diagnosis',
          display: 'Strep throat',
          updates: [{ field: 'code', value: 'S01.81XA' }],
          strength: 'true',
        },
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
  it('refuses an obstetric code for an injury the visit describes plainly', async () => {
    const { actions, rejected } = await run(
      [{ kind: 'add-diagnosis', display: 'Laceration of left forehead', searchTerms: ['laceration'] }],
      'nine-year-old fell off his scooter, two centimeter linear laceration above the left eyebrow'
    );
    expect(actions).toEqual([]);
    expect(rejected).toHaveLength(1);
  });

  it('salvages a code-shaped value from a misplaced field and confirms it', async () => {
    const { actions, rejected } = await run(
      [
        {
          kind: 'add-diagnosis',
          display: 'Laceration of left forehead',
          updates: [{ field: 'code', value: 'S01.81XA' }],
        },
      ],
      'two centimeter linear laceration above the left eyebrow'
    );
    expect(rejected).toEqual([]);
    expect(actions[0]).toMatchObject({ code: 'S01.81XA' });
    expect(actions[0]).not.toHaveProperty('updates');
  });
});

describe('backstop-appended vitals carry numbers', () => {
  it('appends a swept reading as a number, not a string', async () => {
    const dictation = 'Oxygen saturation was 94 percent on room air.';
    const { actions } = await run([], dictation, { dictation });
    const sweep = actions.find((a) => a.kind === 'set-vital');
    expect(sweep).toBeDefined();
    expect(typeof sweep!.value).toBe('number');
    expect(sweep!.value).toBe(94);
  });
});

describe('chart-origin provenance', () => {
  const narrative = 'Sore throat for two days. Will start amoxicillin.';
  const chartStateText = '- In-house lab resulted: Test: Rapid strep | Result: Positive | Flag: abnormal';

  it('keeps a quote of a chart line and tags it chart', async () => {
    const { actions } = await run(
      [
        {
          kind: 'add-diagnosis',
          display: 'Strep throat',
          code: 'J02.0',
          sourceText: 'In-house lab resulted: Test: Rapid strep | Result: Positive',
        },
      ],
      narrative,
      { chartStateText }
    );
    expect(actions[0].sourceText).toBe('In-house lab resulted: Test: Rapid strep | Result: Positive');
    expect(actions[0].sourceOrigin).toBe('chart');
  });

  it('prefers the narrative when the quote is in both', async () => {
    const { actions } = await run(
      [{ kind: 'add-diagnosis', display: 'Strep throat', code: 'J02.0', sourceText: 'Sore throat for two days' }],
      narrative,
      { chartStateText: `${chartStateText}\n- Patient instruction: Sore throat for two days` }
    );
    expect(actions[0].sourceOrigin).toBe('narrative');
  });

  it('drops a quote that is in neither the narrative nor the chart', async () => {
    const { actions } = await run(
      [{ kind: 'add-diagnosis', display: 'Strep throat', code: 'J02.0', sourceText: 'the culture grew group A strep' }],
      narrative,
      { chartStateText }
    );
    expect(actions[0].sourceText).toBeUndefined();
    expect(actions[0].sourceOrigin).toBeUndefined();
  });
});
