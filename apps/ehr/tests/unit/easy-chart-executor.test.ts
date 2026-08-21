// The executor is testable WITHOUT a model, a network or a rendered page: given an action list, its
// behaviour is deterministic. That is the payoff of the "LLM returns typed actions" architecture, so
// these tests exercise it directly.

import { PlannedAction } from 'utils/lib/easy-chart/api';
import { describe, expect, it, vi } from 'vitest';
import { HANDLERS } from '../../src/features/easy-chart/executor/handlers';
import { ProcedureQuickPickContext } from '../../src/features/easy-chart/executor/procedure-quick-pick';
import { AMBIGUITY_RATIO, classifyMatches } from '../../src/features/easy-chart/executor/resolve';
import { runPlan, summarisePlan } from '../../src/features/easy-chart/executor/runPlan';
import {
  CatalogueMatch,
  ChartSnapshot,
  ChartWriter,
  HandlerContext,
  PickerRequest,
  PickerResponse,
} from '../../src/features/easy-chart/executor/types';

const emptyChart = (): ChartSnapshot => ({
  diagnoses: [],
  examFindings: [],
  rosFindings: [],
  medications: [],
  allergies: [],
  conditions: [],
  surgicalHistory: [],
  hospitalizations: [],
  procedures: [],
  cptCodes: [],
  hasEmCode: false,
});

interface Harness {
  context: HandlerContext;
  saved: Record<string, unknown>[];
  removed: { field: string; display: string }[];
  said: { text: string; kind: string }[];
  asks: PickerRequest[];
  orderedLabs: { display: string; inHouse: boolean }[];
  orderedImaging: { id: string; dictatedStudyName: string }[];
  addedProcedures: ProcedureQuickPickContext[];
}

function harness(
  overrides: {
    chart?: Partial<ChartSnapshot>;
    matches?: Record<string, CatalogueMatch[]>;
    mode?: 'bulk' | 'interactive';
    answer?: (request: PickerRequest) => PickerResponse;
    saveFails?: boolean;
    supports?: Partial<ChartWriter['supports']>;
    /** Catalogue name -> the reason it could not be consulted. */
    unavailable?: Record<string, string>;
  } = {}
): Harness {
  const saved: Record<string, unknown>[] = [];
  const removed: { field: string; display: string }[] = [];
  const said: { text: string; kind: string }[] = [];
  const asks: PickerRequest[] = [];
  const orderedLabs: { display: string; inHouse: boolean }[] = [];
  const orderedImaging: { id: string; dictatedStudyName: string }[] = [];
  const addedProcedures: ProcedureQuickPickContext[] = [];
  let nextId = 1;

  const writer: ChartWriter = {
    // Everything supported by default, so a test that cares about the unsupported path says so.
    supports: {
      labOrders: true,
      radiologyOrders: true,
      nursingOrders: true,
      templates: true,
      procedures: true,
      ...overrides.supports,
    },
    // The two saves the real writer makes, in the shape the handler consumes: the procedure row, the
    // linked codes it had to create first, and the fields the template filled.
    addProcedure: async (procedureContext) => {
      if (overrides.saveFails) throw new Error('the chart could not be saved');
      addedProcedures.push(procedureContext);
      const procedureResourceId = `res-${nextId++}`;
      const inferredResourceIds = [...procedureContext.diagnoses, ...procedureContext.cptCodes].map(
        () => `res-${nextId++}`
      );
      return {
        createdResourceIds: [procedureResourceId, ...inferredResourceIds],
        procedureResourceId,
        inferredResourceIds,
        templateFilledFields: procedureContext.templateFilledFields,
      };
    },
    save: async (fields) => {
      if (overrides.saveFails) throw new Error('the chart could not be saved');
      saved.push(fields);
      return [`res-${nextId++}`];
    },
    remove: async (field, item) => {
      removed.push({ field, display: item.display });
    },
    orderLab: async (match, inHouse) => {
      orderedLabs.push({ display: match.display, inHouse });
      return [];
    },
    orderRadiology: async (match, request) => {
      orderedImaging.push({ id: match.id, dictatedStudyName: request.dictatedStudyName });
      return [];
    },
    createNursingOrder: async () => [`res-${nextId++}`],
    applyTemplate: async () => [`res-${nextId++}`],
  };

  const lookup = (name: string) => async (): Promise<CatalogueMatch[]> => overrides.matches?.[name] ?? [];

  const context: HandlerContext = {
    mode: overrides.mode ?? 'bulk',
    encounterId: 'enc-1',
    writer,
    chart: { ...emptyChart(), ...overrides.chart },
    catalogue: {
      examFindings: lookup('examFindings'),
      rosFindings: lookup('rosFindings'),
      medications: lookup('medications'),
      allergies: lookup('allergies'),
      conditions: lookup('conditions'),
      surgicalHistory: lookup('surgicalHistory'),
      hospitalizations: lookup('hospitalizations'),
      templates: lookup('templates'),
      procedures: lookup('procedures'),
      labs: lookup('labs'),
      radiology: lookup('radiology'),
    },
    ask: async (request) => {
      asks.push(request);
      return overrides.answer?.(request);
    },
    say: (text, kind) => said.push({ text, kind }),
  };

  return { context, saved, removed, said, asks, orderedLabs, orderedImaging, addedProcedures };
}

const match = (id: string, display: string, score: number): CatalogueMatch => ({ id, display, score });

describe('every step settles', () => {
  it('reports applied / skipped-with-reason / failed and never leaves a step unsettled', async () => {
    const h = harness({ matches: { medications: [match('m1', 'Amoxicillin 500 mg', 1)] } });
    const actions: PlannedAction[] = [
      { kind: 'add-medication', display: 'Amoxicillin' },
      { kind: 'add-exam-finding', display: 'Right TM bulging' }, // nothing in the catalogue
      { kind: 'add-diagnosis', display: 'Strep throat' }, // no confirmed code
    ];
    const { steps } = await runPlan(actions, h.context);

    expect(steps.map((s) => s.outcome?.status)).toEqual(['applied', 'skipped', 'skipped']);
    for (const step of steps) {
      expect(step.outcome, `step ${step.index} never settled`).toBeDefined();
      if (step.outcome!.status !== 'applied') {
        expect(step.outcome!.reason?.trim(), `step ${step.index} skipped with no reason`).toBeTruthy();
      }
    }
    expect(summarisePlan(steps)).toEqual({ applied: 1, skipped: 2, failed: 0 });
  });

  // An old client against a newer endpoint. Falling through to a generic "no match" would read to a
  // provider as "there was nothing to chart".
  it('says so plainly when the action kind is one this build does not know', async () => {
    const h = harness();
    const { steps } = await runPlan([{ kind: 'add-telepathy' } as unknown as PlannedAction], h.context);
    expect(steps[0].outcome?.status).toBe('skipped');
    expect(steps[0].outcome?.reason).toMatch(/does not know how to do "add-telepathy"/);
  });

  it('reports a required field the assistant did not supply', async () => {
    const h = harness();
    const { steps } = await runPlan([{ kind: 'edit-note-text', field: 'medicalDecision' }], h.context);
    expect(steps[0].outcome?.reason).toMatch(/did not supply newText/);
  });

  it('turns a thrown error into a failed step with readable text, not a crashed run', async () => {
    const h = harness({ saveFails: true });
    const { steps } = await runPlan(
      [
        { kind: 'edit-note-text', field: 'medicalDecision', newText: 'MDM text' },
        { kind: 'add-patient-instruction', text: 'Rest and fluids.' },
      ],
      h.context
    );
    expect(steps[0].outcome?.status).toBe('failed');
    expect(steps[0].outcome?.reason).toMatch(/the chart could not be saved/);
    // The run continues: one bad step must not abandon the rest of the plan.
    expect(steps[1].outcome?.status).toBe('failed');
  });

  it('settles the remaining steps as skipped when the run is cancelled', async () => {
    const h = harness();
    const controller = new AbortController();
    const onStepSettled = vi.fn(() => controller.abort());
    const { steps } = await runPlan(
      [
        { kind: 'add-patient-instruction', text: 'One' },
        { kind: 'add-patient-instruction', text: 'Two' },
      ],
      h.context,
      { onStepSettled, signal: controller.signal }
    );
    expect(steps[0].outcome?.status).toBe('applied');
    expect(steps[1].outcome).toMatchObject({ status: 'skipped', reason: expect.stringMatching(/cancelled/) });
  });

  it('reports progress so the current step can be kept in view', async () => {
    const h = harness();
    const started: number[] = [];
    const settled: number[] = [];
    await runPlan(
      [
        { kind: 'add-patient-instruction', text: 'One' },
        { kind: 'add-patient-instruction', text: 'Two' },
      ],
      h.context,
      { onStepStart: (s) => started.push(s.index), onStepSettled: (s) => settled.push(s.index) }
    );
    expect(started).toEqual([0, 1]);
    expect(settled).toEqual([0, 1]);
  });
});

describe('dispatch table', () => {
  // Exhaustiveness is a compile-time guarantee; this is the runtime twin of it.
  it('has a handler for every registered action kind', async () => {
    const { ACTION_KINDS } = await import('utils/lib/easy-chart/actions');
    expect(Object.keys(HANDLERS).sort()).toEqual([...ACTION_KINDS].sort());
  });
});

describe('the CC↔HPI storage swap is applied exactly once', () => {
  it('writes a clinical Chief Complaint under the historyOfPresentIllness key, and vice versa', async () => {
    const h = harness();
    await runPlan(
      [
        { kind: 'edit-note-text', field: 'chiefComplaint', newText: 'Right ear pain' },
        { kind: 'edit-note-text', field: 'historyOfPresentIllness', newText: '7y M p/w right otalgia x1 day.' },
        { kind: 'edit-note-text', field: 'medicalDecision', newText: 'Consistent with AOM.' },
      ],
      h.context
    );
    expect(h.saved).toEqual([
      { historyOfPresentIllness: { text: 'Right ear pain' } },
      { chiefComplaint: { text: '7y M p/w right otalgia x1 day.' } },
      { medicalDecision: { text: 'Consistent with AOM.' } },
    ]);
  });
});

describe('vitals', () => {
  it('writes the converted value the server produced', async () => {
    const h = harness();
    await runPlan([{ kind: 'set-vital', field: 'vital-height', display: '1.73 m', value: 173, unit: 'cm' }], h.context);
    expect(h.saved[0]).toEqual({ vitalsObservations: [{ field: 'vital-height', value: 173, unit: 'cm' }] });
  });

  it('writes both numbers for a blood pressure', async () => {
    const h = harness();
    await runPlan(
      [{ kind: 'set-vital', field: 'vital-blood-pressure', display: '122/78', systolic: 122, diastolic: 78 }],
      h.context
    );
    expect(h.saved[0]).toEqual({
      vitalsObservations: [{ field: 'vital-blood-pressure', systolicPressure: 122, diastolicPressure: 78 }],
    });
  });

  // A guard let something through: fail loudly rather than writing a vital with no number.
  it('fails rather than charting a vital with no usable reading', async () => {
    const h = harness();
    const { steps } = await runPlan(
      [{ kind: 'set-vital', field: 'vital-weight', display: '80 stones-ish' }],
      h.context
    );
    expect(steps[0].outcome?.status).toBe('failed');
    expect(h.saved).toEqual([]);
  });
});

describe('the exactly-one-primary-diagnosis invariant', () => {
  it('charts the first primary as primary', async () => {
    const h = harness();
    await runPlan([{ kind: 'add-diagnosis', display: 'Strep pharyngitis', code: 'J02.0', isPrimary: true }], h.context);
    expect(h.saved[0]).toEqual({ diagnosis: [{ code: 'J02.0', display: 'Strep pharyngitis', isPrimary: true }] });
  });

  // Demote rather than drop: a note that loses a secondary diagnosis is worse than one with a
  // demoted flag, and the provider is told what happened.
  it('demotes a second primary and says so', async () => {
    const h = harness({
      chart: { diagnoses: [{ resourceId: 'dx-1', display: 'AOM', code: 'H66.91', isPrimary: true }] },
    });
    const { steps } = await runPlan(
      [{ kind: 'add-diagnosis', display: 'Strep pharyngitis', code: 'J02.0', isPrimary: true }],
      h.context
    );
    expect(h.saved[0]).toEqual({ diagnosis: [{ code: 'J02.0', display: 'Strep pharyngitis', isPrimary: false }] });
    expect(steps[0].outcome?.note).toMatch(/charted as secondary/);
  });

  it('skips a diagnosis already on the chart', async () => {
    const h = harness({ chart: { diagnoses: [{ resourceId: 'dx-1', display: 'Strep', code: 'J02.0' }] } });
    const { steps } = await runPlan(
      [{ kind: 'add-diagnosis', display: 'Strep pharyngitis', code: 'J02.0' }],
      h.context
    );
    expect(steps[0].outcome).toMatchObject({
      status: 'skipped',
      reason: expect.stringMatching(/already on the chart/),
    });
    expect(h.saved).toEqual([]);
  });
});

describe('ambiguity', () => {
  it('treats a runner-up within the ratio as ambiguous and a clear winner as confident', () => {
    expect(classifyMatches([match('a', 'A', 1), match('b', 'B', AMBIGUITY_RATIO + 0.01)]).kind).toBe('ambiguous');
    expect(classifyMatches([match('a', 'A', 1), match('b', 'B', AMBIGUITY_RATIO - 0.01)]).kind).toBe('confident');
    expect(classifyMatches([]).kind).toBe('none');
  });

  // During a whole-plan run a provider will not click through dozens of pickers.
  it('auto-picks the top match during a bulk run and marks it low-confidence', async () => {
    const h = harness({
      mode: 'bulk',
      matches: { examFindings: [match('e1', 'Erythematous pharynx', 1), match('e2', 'Erythematous tonsils', 0.95)] },
    });
    const { steps } = await runPlan([{ kind: 'add-exam-finding', display: 'throat injected' }], h.context);
    expect(steps[0].outcome).toMatchObject({ status: 'applied', lowConfidence: true });
    expect(steps[0].outcome?.note).toMatch(/auto-picked from 2/);
    expect(h.asks).toEqual([]);
  });

  it('asks when the provider typed one request and is watching', async () => {
    const h = harness({
      mode: 'interactive',
      matches: { examFindings: [match('e1', 'Erythematous pharynx', 1), match('e2', 'Erythematous tonsils', 0.95)] },
      answer: (request) => request.options[1],
    });
    const { steps } = await runPlan([{ kind: 'add-exam-finding', display: 'throat injected' }], h.context);
    expect(h.asks).toHaveLength(1);
    expect(steps[0].outcome).toMatchObject({ status: 'applied', lowConfidence: false });
    expect(h.saved[0]).toMatchObject({ examObservations: [{ field: 'e2' }] });
  });

  it('skips with a reason when the provider declines the picker', async () => {
    const h = harness({
      mode: 'interactive',
      matches: { examFindings: [match('e1', 'A', 1), match('e2', 'B', 0.95)] },
      answer: () => undefined,
    });
    const { steps } = await runPlan([{ kind: 'add-exam-finding', display: 'something' }], h.context);
    expect(steps[0].outcome).toMatchObject({ status: 'skipped' });
    expect(h.saved).toEqual([]);
  });
});

describe('destructive actions ask', () => {
  // With several plausible matches for a removal we never delete the first substring match.
  it('asks before removing when several charted items match, even in a bulk run', async () => {
    const h = harness({
      mode: 'bulk',
      chart: {
        medications: [
          { resourceId: 'm1', display: 'Ibuprofen 200 mg tablet' },
          { resourceId: 'm2', display: 'Ibuprofen 400 mg tablet' },
        ],
      },
      answer: (request) => request.options[1],
    });
    const { steps } = await runPlan([{ kind: 'remove-medication', display: 'Ibuprofen' }], h.context);
    expect(h.asks[0].destructive).toBe(true);
    expect(steps[0].outcome?.status).toBe('applied');
    expect(h.removed).toEqual([{ field: 'medications', display: 'Ibuprofen 400 mg tablet' }]);
  });

  it('removes without asking when exactly one charted item matches', async () => {
    const h = harness({ chart: { medications: [{ resourceId: 'm1', display: 'Motrin 200 mg' }] } });
    const { steps } = await runPlan([{ kind: 'remove-medication', display: 'Motrin' }], h.context);
    expect(h.asks).toEqual([]);
    expect(steps[0].outcome?.status).toBe('applied');
  });

  it('skips with a reason when nothing on the chart matches', async () => {
    const h = harness({ chart: { medications: [{ resourceId: 'm1', display: 'Amoxicillin' }] } });
    const { steps } = await runPlan([{ kind: 'remove-medication', display: 'Motrin' }], h.context);
    expect(steps[0].outcome).toMatchObject({
      status: 'skipped',
      reason: expect.stringMatching(/is not on the chart/),
    });
    expect(h.removed).toEqual([]);
  });

  it('does not ask twice when the removal names an item exactly', async () => {
    const h = harness({
      chart: {
        medications: [
          { resourceId: 'm1', display: 'ibuprofen' },
          { resourceId: 'm2', display: 'ibuprofen 400 mg tablet' },
        ],
      },
    });
    const { steps } = await runPlan([{ kind: 'remove-medication', display: 'ibuprofen' }], h.context);
    expect(h.asks).toEqual([]);
    expect(steps[0].outcome?.status).toBe('applied');
    expect(h.removed).toEqual([{ field: 'medications', display: 'ibuprofen' }]);
  });
});

describe('chat-only actions', () => {
  it('answers a question without writing anything to the chart', async () => {
    const h = harness();
    const { steps } = await runPlan(
      [{ kind: 'reply', text: 'You still need an E&M level before you can sign.' }],
      h.context
    );
    expect(steps[0].outcome?.status).toBe('applied');
    expect(h.saved).toEqual([]);
    expect(h.said).toEqual([{ text: 'You still need an E&M level before you can sign.', kind: 'reply' }]);
  });

  it('surfaces a provider note in the chat and charts nothing', async () => {
    const h = harness();
    await runPlan([{ kind: 'provider-note', text: 'Send the erythromycin prescription by eRx.' }], h.context);
    expect(h.saved).toEqual([]);
    expect(h.said[0].kind).toBe('provider-note');
  });
});

describe('the created-row map', () => {
  it('records which step created each row, so provenance can be attached', async () => {
    const h = harness();
    const { createdBy } = await runPlan(
      [
        { kind: 'edit-note-text', field: 'medicalDecision', newText: 'MDM', sourceText: 'the plan is' },
        { kind: 'add-patient-instruction', text: 'Rest.' },
      ],
      h.context
    );
    expect([...createdBy.keys()]).toEqual(['res-1', 'res-2']);
    expect(createdBy.get('res-1')?.action.kind).toBe('edit-note-text');
  });
});

describe('primary diagnosis is not lost when a plan swaps it', () => {
  // REGRESSION. The review pass corrects a wrong diagnosis as a PAIR: remove-diagnosis +
  // add-diagnosis. The add carries isPrimary:false (or omits it) because of the never-usurp rule —
  // correct for a pure addition, wrong here: the diagnosis being removed IS the primary, so the note
  // ends up with no primary at all, which is billing-invalid.
  const PRIMARY = [{ resourceId: 'dx-1', display: 'Viral pharyngitis', code: 'J02.9', isPrimary: true }];

  it('promotes the replacement when the removed diagnosis was primary', async () => {
    const h = harness({ chart: { diagnoses: PRIMARY } });
    const { steps } = await runPlan(
      [
        { kind: 'remove-diagnosis', display: 'Viral pharyngitis' },
        { kind: 'add-diagnosis', display: 'Strep pharyngitis', code: 'J02.0', isPrimary: false },
      ],
      h.context
    );
    expect(steps.map((s) => s.outcome?.status)).toEqual(['applied', 'applied']);
    const charted = h.saved.flatMap((f) => (f.diagnosis as { isPrimary?: boolean }[]) ?? []);
    expect(charted).toHaveLength(1);
    expect(charted[0].isPrimary).toBe(true);
  });

  it('does not promote when the removed diagnosis was NOT primary', async () => {
    const secondary = [
      { resourceId: 'dx-1', display: 'Fever', code: 'R50.9', isPrimary: false },
      { resourceId: 'dx-2', display: 'Otitis media', code: 'H66.90', isPrimary: true },
    ];
    const h = harness({ chart: { diagnoses: secondary } });
    await runPlan(
      [
        { kind: 'remove-diagnosis', display: 'Fever' },
        { kind: 'add-diagnosis', display: 'Pharyngitis', code: 'J02.9', isPrimary: false },
      ],
      h.context
    );
    const charted = h.saved.flatMap((f) => (f.diagnosis as { isPrimary?: boolean }[]) ?? []);
    expect(charted[0].isPrimary).toBe(false);
  });

  it('never mints a second primary when an add already claims it', async () => {
    const h = harness({ chart: { diagnoses: PRIMARY } });
    await runPlan(
      [
        { kind: 'remove-diagnosis', display: 'Viral pharyngitis' },
        { kind: 'add-diagnosis', display: 'Strep pharyngitis', code: 'J02.0', isPrimary: true },
        { kind: 'add-diagnosis', display: 'Fever', code: 'R50.9', isPrimary: false },
      ],
      h.context
    );
    const charted = h.saved.flatMap((f) => (f.diagnosis as { isPrimary?: boolean }[]) ?? []);
    expect(charted.filter((d) => d.isPrimary)).toHaveLength(1);
  });
});

describe('a plan sees what its own earlier steps charted', () => {
  // REGRESSION. The snapshot used to be built once, before the run. A plan that charts a diagnosis and
  // THEN orders a lab is the normal shape — the planner charts the assessment before the plan — but the
  // lab step read the pre-plan snapshot, saw no diagnosis, and skipped an order the provider voiced.
  it('orders a send-out lab against a diagnosis added earlier in the same plan', async () => {
    const h = harness({ matches: { labs: [match('cbc', 'CBC', 1)] } });
    const { steps } = await runPlan(
      [
        { kind: 'add-diagnosis', display: 'Fatigue', code: 'R53.83', isPrimary: true },
        { kind: 'add-external-lab', display: 'CBC' },
      ],
      h.context
    );
    expect(steps[0].outcome?.status).toBe('applied');
    expect(steps[1].outcome?.status, steps[1].outcome?.reason).toBe('applied');
  });
});

describe('ROS polarity is stored in the field key', () => {
  // ROS storage gives each symptom two fields, `…-denies` and `…-reports`, and records the applicable one
  // with value:true — that is what RosReviewContainer reads on Review & Sign. Writing the BASE key with
  // the polarity in the boolean produced a shape nothing reads: the signed note's ROS section came out
  // empty, and a denial was invisible in Easy Chart too, because the snapshot keeps only value===true.
  const ros = { rosFindings: [match('ros-gi-vomiting', 'Vomiting', 1)] };

  it('charts a denial as the -denies field with value true', async () => {
    const h = harness({ matches: ros });
    await runPlan(
      [{ kind: 'add-ros-finding', display: 'Denies vomiting', finding: 'denies' } as PlannedAction],
      h.context
    );
    const written = h.saved.flatMap((call) => (call.rosObservations as { field: string; value: boolean }[]) ?? []);
    expect(written).toEqual([{ field: 'ros-gi-vomiting-denies', value: true }]);
  });

  it('charts a reported symptom as the -reports field with value true', async () => {
    const h = harness({ matches: ros });
    await runPlan(
      [{ kind: 'add-ros-finding', display: 'Reports vomiting', finding: 'reports' } as PlannedAction],
      h.context
    );
    const written = h.saved.flatMap((call) => (call.rosObservations as { field: string; value: boolean }[]) ?? []);
    expect(written).toEqual([{ field: 'ros-gi-vomiting-reports', value: true }]);
  });
});
