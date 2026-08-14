import { DiagnosisDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { EasyChartAgentIntent } from 'utils/lib/types/data/easy-chart-agent.types';
import { describe, expect, it } from 'vitest';
import { carrySwapPrimary, pickPrimaryPromotion } from '../../src/features/easy-charting/intent-logic';

// The review's diagnosis-swap card (remove-diagnosis + add-diagnosis) must never demote the chart's
// primary: the model reliably omits isPrimary on the add, and a missing flag charts as secondary —
// leaving the note with NO primary dx (billing-invalid). These two pure helpers are the client's
// deterministic fix; the eval harness's apply-loop sim mirrors them, so lock the contract in.
describe('carrySwapPrimary', () => {
  const chart = {
    diagnosis: [
      { resourceId: 'dx1', code: 'H66.003', display: 'Acute suppurative otitis media, bilateral', isPrimary: true },
      { resourceId: 'dx2', code: 'J02.0', display: 'Streptococcal pharyngitis', isPrimary: false },
    ],
  } as unknown as GetChartDataResponse;

  // The model omits isPrimary — build the action objects exactly as they arrive off the wire.
  const remove = (display: string): EasyChartAgentIntent =>
    ({ kind: 'remove-diagnosis', display, searchTerms: [] }) as unknown as EasyChartAgentIntent;
  const addNoFlag = (display: string, code?: string): EasyChartAgentIntent =>
    ({ kind: 'add-diagnosis', display, searchTerms: [], code }) as unknown as EasyChartAgentIntent;

  it('carries isPrimary: true when the removed dx is the primary', () => {
    const out = carrySwapPrimary(
      [remove('Acute suppurative otitis media, bilateral'), addNoFlag('Recurrent AOM, bilateral', 'H66.006')],
      chart
    );
    expect((out[1] as { isPrimary?: boolean }).isPrimary).toBe(true);
  });

  it('carries isPrimary: false when the removed dx is a secondary', () => {
    const out = carrySwapPrimary([remove('Streptococcal pharyngitis'), addNoFlag('Acute pharyngitis')], chart);
    expect((out[1] as { isPrimary?: boolean }).isPrimary).toBe(false);
  });

  it('never overrides a model-stated isPrimary', () => {
    const explicit = {
      kind: 'add-diagnosis',
      display: 'Recurrent AOM',
      searchTerms: [],
      isPrimary: false,
    } as unknown as EasyChartAgentIntent;
    const out = carrySwapPrimary([remove('Acute suppurative otitis media, bilateral'), explicit], chart);
    expect((out[1] as { isPrimary?: boolean }).isPrimary).toBe(false);
  });

  it('passes through untouched when the remove matches nothing on the chart', () => {
    const actions = [remove('Fracture of distal radius'), addNoFlag('Torus fracture')];
    expect(carrySwapPrimary(actions, chart)).toBe(actions);
  });

  it('passes through untouched without a remove-diagnosis in the card', () => {
    const actions = [addNoFlag('Contact dermatitis')];
    expect(carrySwapPrimary(actions, chart)).toBe(actions);
  });

  it('gives the carried primary to the FIRST unmarked add only; later adds become secondary', () => {
    const out = carrySwapPrimary(
      [remove('Acute suppurative otitis media, bilateral'), addNoFlag('Recurrent AOM'), addNoFlag('Otitis externa')],
      chart
    );
    expect((out[1] as { isPrimary?: boolean }).isPrimary).toBe(true);
    expect((out[2] as { isPrimary?: boolean }).isPrimary).toBe(false);
  });

  it('does not mutate the input actions', () => {
    const actions = [remove('Acute suppurative otitis media, bilateral'), addNoFlag('Recurrent AOM')];
    carrySwapPrimary(actions, chart);
    expect((actions[1] as { isPrimary?: unknown }).isPrimary).toBeUndefined();
  });

  // PLANNER path (reclaimPrimary): on an incremental plan the planner server's never-usurp rule
  // stamps explicit isPrimary:false on every add — correct for pure additions, wrong when the same
  // plan REMOVES the primary. reclaimPrimary lets the replacement reclaim it in exactly that case.
  describe('reclaimPrimary (planner plan path)', () => {
    const addExplicit = (display: string, isPrimary: boolean): EasyChartAgentIntent =>
      ({ kind: 'add-diagnosis', display, searchTerms: [], isPrimary }) as unknown as EasyChartAgentIntent;

    it('remove-primary + explicit-false add: the replacement reclaims primary', () => {
      const out = carrySwapPrimary(
        [remove('Acute suppurative otitis media, bilateral'), addExplicit('Recurrent AOM, bilateral', false)],
        chart,
        { reclaimPrimary: true }
      );
      expect((out[1] as { isPrimary?: boolean }).isPrimary).toBe(true);
    });

    it('remove-secondary + explicit-false add: stays secondary (untouched)', () => {
      const actions = [remove('Streptococcal pharyngitis'), addExplicit('Acute pharyngitis', false)];
      expect(carrySwapPrimary(actions, chart, { reclaimPrimary: true })).toBe(actions);
    });

    it('add-only plan: untouched — never-usurp stays intact', () => {
      const actions = [addExplicit('Contact dermatitis', false)];
      expect(carrySwapPrimary(actions, chart, { reclaimPrimary: true })).toBe(actions);
    });

    it('never reclaims over an add the model already marked primary', () => {
      const actions = [
        remove('Acute suppurative otitis media, bilateral'),
        addExplicit('Recurrent AOM, bilateral', true),
        addExplicit('Otitis externa', false),
      ];
      expect(carrySwapPrimary(actions, chart, { reclaimPrimary: true })).toBe(actions);
    });

    it('remove-primary + unmarked add: carries primary same as the review path', () => {
      const out = carrySwapPrimary(
        [remove('Acute suppurative otitis media, bilateral'), addNoFlag('Recurrent AOM')],
        chart,
        {
          reclaimPrimary: true,
        }
      );
      expect((out[1] as { isPrimary?: boolean }).isPrimary).toBe(true);
    });

    it('without reclaimPrimary an explicit false is never overridden (review behavior)', () => {
      const actions = [remove('Acute suppurative otitis media, bilateral'), addExplicit('Recurrent AOM', false)];
      expect(carrySwapPrimary(actions, chart)).toBe(actions);
    });
  });
});

describe('pickPrimaryPromotion', () => {
  const dx = (over: Partial<DiagnosisDTO> & { resourceId?: string }): DiagnosisDTO =>
    ({ code: 'R00.0', display: 'x', isPrimary: false, ...over }) as DiagnosisDTO;
  const add = (display: string, code?: string): EasyChartAgentIntent =>
    ({ kind: 'add-diagnosis', display, searchTerms: [], code, isPrimary: false }) as unknown as EasyChartAgentIntent;

  it('returns undefined when a primary already exists', () => {
    const list = [dx({ resourceId: 'a', isPrimary: true }), dx({ resourceId: 'b' })];
    expect(pickPrimaryPromotion([add('x')], list)).toBeUndefined();
  });

  it('returns undefined when there are no charted diagnoses', () => {
    expect(pickPrimaryPromotion([add('x')], [])).toBeUndefined();
    expect(pickPrimaryPromotion([add('x')], undefined)).toBeUndefined();
  });

  it('prefers the dx matching a suggestion add by code', () => {
    const list = [dx({ resourceId: 'a', code: 'J02.0' }), dx({ resourceId: 'b', code: 'H66.006' })];
    expect(pickPrimaryPromotion([add('Recurrent AOM', 'h66.006')], list)?.resourceId).toBe('b');
  });

  it('falls back to display substring match (either direction)', () => {
    const list = [
      dx({ resourceId: 'a', code: 'J02.0', display: 'Streptococcal pharyngitis' }),
      dx({ resourceId: 'b', code: 'H66.006', display: 'Acute suppurative otitis media, recurrent, bilateral' }),
    ];
    expect(pickPrimaryPromotion([add('otitis media, recurrent')], list)?.resourceId).toBe('b');
  });

  it('falls back to the first charted dx when no add matches', () => {
    const list = [dx({ resourceId: 'a', code: 'J02.0' }), dx({ resourceId: 'b', code: 'H66.006' })];
    expect(pickPrimaryPromotion([add('Something else', 'Z00.00')], list)?.resourceId).toBe('a');
  });

  it('ignores diagnoses without a resourceId', () => {
    const list = [dx({}), dx({ resourceId: 'b', code: 'H66.006' })];
    expect(pickPrimaryPromotion([], list)?.resourceId).toBe('b');
  });
});
