// The deterministic filters only the review surface runs, plus the trigger aggregation they share.

import { PlannedAction } from 'utils/lib/easy-chart/api';
import { describe, expect, it } from 'vitest';
import { dropOrphanedRemovals, rosActionIsVerbatim, swapCancelsItself } from '../src/ehr/easy-chart-review/helpers';
import { buildTriggerReports } from '../src/ehr/easy-chart-shared/guards';

describe('review verbatim guard for ROS negatives', () => {
  const narrative = 'Patient here for left eye redness and itching for two days. Denies eye pain and denies fever.';

  it('keeps a negative whose words the dictation actually contains', () => {
    expect(rosActionIsVerbatim({ kind: 'add-ros-finding', display: 'Denies eye pain' }, narrative)).toBe(true);
  });

  it('drops a classic negative the provider never voiced', () => {
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
    const rejected: { kind: string; display?: string; reason: string }[] = [];
    expect(dropOrphanedRemovals([removeDx, addDx], [removeDx], rejected)).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/could not be charted/);
  });

  it('keeps the pair when the replacement survived', () => {
    expect(dropOrphanedRemovals([removeDx, addDx], [removeDx, addDx], [])).toEqual([removeDx, addDx]);
  });

  it('keeps a removal the card never paired with an addition', () => {
    // A bare removal is legitimate when the note supports no replacement at all.
    expect(dropOrphanedRemovals([removeDx], [removeDx], [])).toEqual([removeDx]);
  });

  it('leaves unrelated actions on the same card alone', () => {
    const ros: PlannedAction = { kind: 'add-ros-finding', display: 'Denies fever' };
    expect(dropOrphanedRemovals([removeDx, addDx, ros], [removeDx, ros], [])).toEqual([ros]);
  });

  it('applies to medication swaps too', () => {
    const removeMed: PlannedAction = { kind: 'remove-medication', display: 'Ciner' };
    const addMed: PlannedAction = { kind: 'add-medication', display: 'Cefdinir' };
    expect(dropOrphanedRemovals([removeMed, addMed], [removeMed], [])).toEqual([]);
  });
});

describe('swapCancelsItself', () => {
  it('flags a swap whose replacement resolved back to the code it replaces', () => {
    expect(
      swapCancelsItself([
        { kind: 'remove-diagnosis', display: 'Tenosynovitis (M65.051)' },
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
    const reports = buildTriggerReports(narrative, [{ kind: 'add-diagnosis', display: 'Otitis externa' }]);
    const disposition = reports.find((r) => r.trigger === 'disposition-language-without-disposition');
    expect(disposition).toMatchObject({ fired: true, complied: false });
  });
});
