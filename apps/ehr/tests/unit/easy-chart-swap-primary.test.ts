import { DiagnosisDTO, EasyChartAgentIntent, GetChartDataResponse } from 'utils';
import { describe, expect, it } from 'vitest';
import { carryReviewSwapPrimary, pickPrimaryPromotion } from '../../src/features/easy-charting/intent-logic';

// The review's diagnosis-swap card (remove-diagnosis + add-diagnosis) must never demote the chart's
// primary: the model reliably omits isPrimary on the add, and a missing flag charts as secondary —
// leaving the note with NO primary dx (billing-invalid). These two pure helpers are the client's
// deterministic fix; the eval harness's apply-loop sim mirrors them, so lock the contract in.
describe('carryReviewSwapPrimary', () => {
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
    const out = carryReviewSwapPrimary(
      [remove('Acute suppurative otitis media, bilateral'), addNoFlag('Recurrent AOM, bilateral', 'H66.006')],
      chart
    );
    expect((out[1] as { isPrimary?: boolean }).isPrimary).toBe(true);
  });

  it('carries isPrimary: false when the removed dx is a secondary', () => {
    const out = carryReviewSwapPrimary([remove('Streptococcal pharyngitis'), addNoFlag('Acute pharyngitis')], chart);
    expect((out[1] as { isPrimary?: boolean }).isPrimary).toBe(false);
  });

  it('never overrides a model-stated isPrimary', () => {
    const explicit = {
      kind: 'add-diagnosis',
      display: 'Recurrent AOM',
      searchTerms: [],
      isPrimary: false,
    } as unknown as EasyChartAgentIntent;
    const out = carryReviewSwapPrimary([remove('Acute suppurative otitis media, bilateral'), explicit], chart);
    expect((out[1] as { isPrimary?: boolean }).isPrimary).toBe(false);
  });

  it('passes through untouched when the remove matches nothing on the chart', () => {
    const actions = [remove('Fracture of distal radius'), addNoFlag('Torus fracture')];
    expect(carryReviewSwapPrimary(actions, chart)).toBe(actions);
  });

  it('passes through untouched without a remove-diagnosis in the card', () => {
    const actions = [addNoFlag('Contact dermatitis')];
    expect(carryReviewSwapPrimary(actions, chart)).toBe(actions);
  });

  it('gives the carried primary to the FIRST unmarked add only; later adds become secondary', () => {
    const out = carryReviewSwapPrimary(
      [remove('Acute suppurative otitis media, bilateral'), addNoFlag('Recurrent AOM'), addNoFlag('Otitis externa')],
      chart
    );
    expect((out[1] as { isPrimary?: boolean }).isPrimary).toBe(true);
    expect((out[2] as { isPrimary?: boolean }).isPrimary).toBe(false);
  });

  it('does not mutate the input actions', () => {
    const actions = [remove('Acute suppurative otitis media, bilateral'), addNoFlag('Recurrent AOM')];
    carryReviewSwapPrimary(actions, chart);
    expect((actions[1] as { isPrimary?: unknown }).isPrimary).toBeUndefined();
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
