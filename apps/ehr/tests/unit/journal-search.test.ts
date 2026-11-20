import { describe, expect, it } from 'vitest';
import { matchesSearch } from '../../src/features/journal/helpers/journalHelpers';

describe('journal search', () => {
  it('matches when every typed word starts a word of the name, in any order', () => {
    expect(matchesSearch('Gus Pending', 'gus pending')).toBe(true);
    expect(matchesSearch('Gus Pending', 'pen g')).toBe(true);
    expect(matchesSearch('Gus Pending', '  gus   ')).toBe(true);
    expect(matchesSearch('Gus Pending', 'gus x')).toBe(false);
    expect(matchesSearch('Gus Pending', 'ending')).toBe(false);
  });
});
