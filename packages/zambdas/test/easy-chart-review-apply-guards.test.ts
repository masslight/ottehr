// The three deterministic filters the review surface runs that the plan surface does not, plus the
// trigger aggregation they share. Each exists for a measured failure on the harvested corpus; the
// narratives and chart states below are synthetic.

import { RawAction } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { describe, expect, it } from 'vitest';
import { dropOrphanedRemovals, rosActionIsVerbatim, swapCancelsItself } from '../src/ehr/easy-chart-review/index';
import { applyGuards, buildTriggerReports, GuardResult } from '../src/ehr/easy-chart-shared/guards';

describe('review verbatim guard for ROS negatives', () => {
  const narrative = 'Patient here for left eye redness and itching for two days. Denies eye pain and denies fever.';

  it('keeps a negative whose words the dictation actually contains', () => {
    expect(rosActionIsVerbatim({ kind: 'add-ros-finding', display: 'Denies eye pain' }, narrative)).toBe(true);
  });

  it('drops a classic negative the provider never voiced', () => {
    // The exact failure this replaces: flash-lite pulling "sinus pain" from memory on an eye visit
    // because it is typical for the complaint, despite the prompt demanding a near-verbatim quote.
    expect(rosActionIsVerbatim({ kind: 'add-ros-finding', display: 'Denies sinus pain' }, narrative)).toBe(false);
  });

  it('ignores the Denies/Reports prefix and short filler words when matching', () => {
    expect(rosActionIsVerbatim({ kind: 'add-ros-finding', display: 'Reports the itching' }, narrative)).toBe(true);
  });

  it('judges only ROS additions — every other kind passes through', () => {
    expect(rosActionIsVerbatim({ kind: 'add-diagnosis', display: 'Acute conjunctivitis' }, narrative)).toBe(true);
    expect(rosActionIsVerbatim({ kind: 'set-disposition', text: 'Follow up with ophthalmology' }, narrative)).toBe(
      true
    );
  });
});

describe('dropOrphanedRemovals', () => {
  const removeDx: PlannedAction = { kind: 'remove-diagnosis', display: 'Acute vaginitis (N76.0)' };
  const addDx: PlannedAction = { kind: 'add-diagnosis', display: 'Candidal vulvovaginitis', code: 'B37.3' };

  it('drops the removal when the replacement did not survive the guards', () => {
    // The bare-removal bug: a swap whose add was refused takes the diagnosis off the chart and puts
    // nothing back, which is how a note ended up with zero diagnoses.
    const rejected: { kind: string; display?: string; reason: string }[] = [];
    expect(dropOrphanedRemovals([removeDx, addDx], [removeDx], rejected)).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/could not be charted/);
  });

  it('keeps the pair when the replacement survived', () => {
    expect(dropOrphanedRemovals([removeDx, addDx], [removeDx, addDx], [])).toEqual([removeDx, addDx]);
  });

  it('keeps a removal the card never paired with an addition', () => {
    // Check 9 may legitimately emit a bare removal when the note supports no replacement at all.
    expect(dropOrphanedRemovals([removeDx], [removeDx], [])).toEqual([removeDx]);
  });

  it('leaves unrelated actions on the same card alone', () => {
    const ros: PlannedAction = { kind: 'add-ros-finding', display: 'Denies fever' };
    expect(dropOrphanedRemovals([removeDx, addDx, ros], [removeDx, ros], [])).toEqual([ros]);
  });

  it('applies to CPT and medication swaps too', () => {
    const removeCpt: PlannedAction = { kind: 'remove-cpt', display: '99213', code: '99213' };
    const addCpt: PlannedAction = { kind: 'add-cpt', display: 'Cerumen removal', code: '69210' };
    expect(dropOrphanedRemovals([removeCpt, addCpt], [removeCpt], [])).toEqual([]);
  });
});

describe('swapCancelsItself', () => {
  it('flags a swap whose replacement resolved back to the code it replaces', () => {
    // Happens when the ICD search was itself the reason the first code was wrong, so the replacement
    // re-resolves to it. Applying the card churns the chart and changes nothing.
    expect(
      swapCancelsItself([
        { kind: 'remove-diagnosis', display: 'Tenosynovitis (M65.051)' },
        { kind: 'add-diagnosis', display: 'Tenosynovitis of left thumb', code: 'M65.051' },
      ])
    ).toBe(true);
  });

  it('reads the removed code from an explicit code field as well as the display', () => {
    expect(
      swapCancelsItself([
        { kind: 'remove-diagnosis', display: 'Tenosynovitis', code: 'M65051' },
        { kind: 'add-diagnosis', display: 'Tenosynovitis of left thumb', code: 'M65.051' },
      ])
    ).toBe(true);
  });

  it('passes a genuine swap', () => {
    expect(
      swapCancelsItself([
        { kind: 'remove-diagnosis', display: 'Acute vaginitis (N76.0)' },
        { kind: 'add-diagnosis', display: 'Candidal vulvovaginitis', code: 'B37.3' },
      ])
    ).toBe(false);
  });

  it('passes a card with no removal at all', () => {
    expect(swapCancelsItself([{ kind: 'add-diagnosis', display: 'Otitis externa', code: 'H60.391' }])).toBe(false);
  });
});

describe('trigger compliance is judged over the whole response', () => {
  const narrative = 'Told her to follow up with her PCP in a week if it is not better.';

  it('reports complied when a surviving action answers the trigger', () => {
    const reports = buildTriggerReports(narrative, [
      { kind: 'add-diagnosis', display: 'Otitis externa', code: 'H60.391' },
      { kind: 'set-disposition', dispositionType: 'pcp', text: 'Follow up with PCP in one week', followUpInDays: 7 },
    ]);
    const disposition = reports.find((r) => r.trigger === 'disposition-language-without-disposition');
    expect(disposition).toMatchObject({ fired: true, complied: true });
  });

  it('reports not-complied when nothing in the response answers it', () => {
    // The per-card computation this replaces reported exactly this — fired, not complied — on all six
    // harvested cases where the disposition was in fact charted, because it only ever saw one card.
    const reports = buildTriggerReports(narrative, [{ kind: 'add-diagnosis', display: 'Otitis externa' }]);
    const disposition = reports.find((r) => r.trigger === 'disposition-language-without-disposition');
    expect(disposition).toMatchObject({ fired: true, complied: false });
  });
});

// Exam and ROS removals must name something actually on the chart. These two kinds used to stop at the
// polarity check and skip `guardRemoval` entirely, so "a remove-* may only target an item listed in
// ALREADY ON THE CHART" went unenforced for the two kinds that make up nearly every removal the
// `findings` stage emits: 18 removals on the hybrid, 14 of which matched nothing.
describe('exam and ROS removals are checked against the chart', () => {
  const chartedItems = ['ROS already charted: Denies fever', 'Erythematous ear canal', 'Cerumen impaction'];
  const guard = (action: PlannedAction): Promise<GuardResult> =>
    applyGuards([action as RawAction], {
      oystehr: undefined as never,
      icdSearch: async () => [],
      narrative: 'Denies fever. Erythematous left ear canal.',
      chartedItems,
      logPrefix: 'test',
    });

  it('rejects a ROS removal naming the OPPOSITE polarity to what is charted', async () => {
    // The exact observed failure: chart holds "Denies fever", the stage asks to remove "Reports fever".
    // Polarity-valid, so the old polarity-only check passed it through.
    const { actions, rejected } = await guard({ kind: 'remove-ros-finding', display: 'Reports fever' });
    expect(actions).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/is not on the chart/);
  });

  it('allows a ROS removal that names the charted entry', async () => {
    const { actions, rejected } = await guard({ kind: 'remove-ros-finding', display: 'Denies fever' });
    expect(rejected).toHaveLength(0);
    expect(actions).toHaveLength(1);
  });

  it('rejects an exam removal naming a normality phrase that is not a charted finding', async () => {
    const { actions } = await guard({ kind: 'remove-exam-finding', display: 'Nontender' });
    expect(actions).toHaveLength(0);
  });

  it('allows an exam removal that names a charted abnormal finding', async () => {
    const { actions, rejected } = await guard({ kind: 'remove-exam-finding', display: 'Cerumen impaction' });
    expect(rejected).toHaveLength(0);
    expect(actions).toHaveLength(1);
  });

  it('still rejects an exam removal whose display is a negative', async () => {
    // The pre-existing polarity rule, which must survive the added chart check: "no cerumen impaction"
    // AGREES with the normal and must not delete the abnormal finding.
    const { actions, rejected } = await guard({ kind: 'remove-exam-finding', display: 'No cerumen impaction' });
    expect(actions).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/is a negative/);
  });
});
