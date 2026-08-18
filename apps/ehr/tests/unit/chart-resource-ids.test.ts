import { describe, expect, it } from 'vitest';
import {
  collectResourceIds,
  diffCreatedResourceIds,
} from '../../src/features/visits/shared/stores/appointment/chart-resource-ids';

describe('collectResourceIds', () => {
  it('finds resourceIds at any depth, across sections', () => {
    const chart = {
      chiefComplaint: { resourceId: 'cc-1', text: 'Ear pain' },
      diagnosis: [
        { resourceId: 'dx-1', code: 'H66.91' },
        { resourceId: 'dx-2', code: 'J02.0' },
      ],
      aiChat: { documents: [{ id: 'doc-1' }], providers: [] },
      inHouseLabResults: { labs: [{ nested: { deeper: { resourceId: 'lab-1' } } }] },
    };
    expect([...collectResourceIds(chart)].sort()).toEqual(['cc-1', 'dx-1', 'dx-2', 'lab-1']);
  });

  // Generic on purpose: a hand-written list of sections to walk goes stale the first time someone
  // adds a section, and the symptom is an AI-written row rendering as provider-entered.
  it('picks up a section it has never heard of', () => {
    expect([...collectResourceIds({ somethingNew: [{ resourceId: 'new-1' }] })]).toEqual(['new-1']);
  });

  it('ignores blank and non-string resourceIds, and survives null', () => {
    expect([...collectResourceIds({ a: { resourceId: '' }, b: { resourceId: 42 }, c: null })]).toEqual([]);
    expect([...collectResourceIds(undefined)]).toEqual([]);
  });

  it('accumulates into a caller-supplied set', () => {
    const into = new Set(['existing']);
    collectResourceIds({ resourceId: 'added' }, into);
    expect([...into].sort()).toEqual(['added', 'existing']);
  });
});

describe('diffCreatedResourceIds', () => {
  it('returns only the ids that were not there before', () => {
    const before = new Set(['dx-1', 'cc-1']);
    expect(diffCreatedResourceIds(before, ['cc-1', 'dx-1', 'dx-2', 'med-1'])).toEqual(['dx-2', 'med-1']);
  });

  it('returns nothing when the save added nothing', () => {
    expect(diffCreatedResourceIds(new Set(['dx-1']), ['dx-1'])).toEqual([]);
  });

  it('treats an empty baseline as "everything is new"', () => {
    expect(diffCreatedResourceIds(new Set(), ['dx-1', 'dx-2'])).toEqual(['dx-1', 'dx-2']);
  });
});
