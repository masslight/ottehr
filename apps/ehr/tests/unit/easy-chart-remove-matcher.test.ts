import { GetChartDataResponse } from 'utils';
import { describe, expect, it } from 'vitest';
import { RemoveIntent } from '../../src/features/easy-charting/chart-types';
import { findRemoveMatches } from '../../src/features/easy-charting/intent-logic';

// The remove matcher decides which charted item a conversational "remove the …" deletes — a wrong
// or missed match is clinical-data loss or a dead end, so lock in the matching rules.
describe('findRemoveMatches', () => {
  const chart = {
    diagnosis: [
      {
        resourceId: 'dx1',
        code: 'S19.9XXA',
        display: 'Unspecified injury of neck, initial encounter',
        isPrimary: true,
      },
      { resourceId: 'dx2', code: 'J02.0', display: 'Streptococcal pharyngitis', isPrimary: false },
    ],
    medications: [
      { resourceId: 'm1', name: 'Amoxicillin' },
      { resourceId: 'm2', name: 'Amoxicillin-Clavulanate' },
      { resourceId: 'm3', name: 'Ibuprofen' },
    ],
    allergies: [{ resourceId: 'a1', name: 'Penicillin G' }],
  } as unknown as GetChartDataResponse;

  const intent = (kind: RemoveIntent['kind'], display: string, searchTerms: string[] = []): RemoveIntent =>
    ({ kind, display, searchTerms }) as RemoveIntent;

  it('matches by substring (either direction)', () => {
    const m = findRemoveMatches(intent('remove-medication', 'ibuprofen'), chart);
    expect(m.map((x) => x.resourceId)).toEqual(['m3']);
  });

  it('matches order-free tokens ("neck injury" vs "injury of neck")', () => {
    const m = findRemoveMatches(intent('remove-diagnosis', 'neck injury'), chart);
    expect(m.map((x) => x.resourceId)).toEqual(['dx1']);
  });

  it('ignores glue words in the term ("the injury of the neck")', () => {
    const m = findRemoveMatches(intent('remove-diagnosis', 'the injury of the neck'), chart);
    expect(m.map((x) => x.resourceId)).toEqual(['dx1']);
  });

  it('returns MULTIPLE matches for genuinely ambiguous removals (dispatch shows the picker)', () => {
    const m = findRemoveMatches(intent('remove-medication', 'amoxicillin'), chart);
    expect(m.map((x) => x.resourceId).sort()).toEqual(['m1', 'm2']);
  });

  it('matches diagnoses by exact code term', () => {
    const m = findRemoveMatches(intent('remove-diagnosis', 'strep throat', ['J02.0']), chart);
    expect(m.map((x) => x.resourceId)).toEqual(['dx2']);
  });

  it('does not match an unrelated word set', () => {
    expect(findRemoveMatches(intent('remove-diagnosis', 'ankle sprain'), chart)).toEqual([]);
  });

  it('tolerates a missing/absent searchTerms array and null chart data', () => {
    expect(findRemoveMatches({ kind: 'remove-medication', display: 'ibuprofen' } as RemoveIntent, chart)).toHaveLength(
      1
    );
    expect(findRemoveMatches(intent('remove-medication', 'ibuprofen'), null)).toEqual([]);
  });
});
