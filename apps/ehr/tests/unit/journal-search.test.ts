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

  it('ignores accents, hyphens and apostrophes, as Oystehr name search ignores accents', () => {
    expect(matchesSearch('Sofía García', 'sofia garcia')).toBe(true);
    expect(matchesSearch('Ana García-López', 'lopez')).toBe(true);
    expect(matchesSearch('Ana García-López', 'garcia-lopez')).toBe(true);
    expect(matchesSearch("Liam O'Brien", 'obrien')).toBe(true);
    expect(matchesSearch("Liam O'Brien", 'brien')).toBe(true);
    expect(matchesSearch("Liam O'Brien", "o'brien")).toBe(true);
    expect(matchesSearch('Sofía García', 'garcío')).toBe(false);
  });
});
