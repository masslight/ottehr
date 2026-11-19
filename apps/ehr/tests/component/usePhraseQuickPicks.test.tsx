import { renderHook } from '@testing-library/react';
import { Phrase } from 'utils/lib/fhir/practitioners';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let phrases: Phrase[] = [];

vi.mock('../../src/hooks/usePhrases', () => ({
  usePhrases: () => phrases,
}));

import { usePhraseQuickPicks } from '../../src/hooks/usePhraseQuickPicks';
import { useCommandPaletteStore } from '../../src/state/command-palette.store';

const renderDescriptions = (values: string[]): (string | undefined)[] => {
  phrases = values.map((value, index) => ({ key: `key${index}`, value }));
  renderHook(() => usePhraseQuickPicks());
  return (useCommandPaletteStore.getState().sources['phrases']?.items ?? []).map((item) => item.description);
};

describe('usePhraseQuickPicks description', () => {
  beforeEach(() => {
    useCommandPaletteStore.setState({ sources: {} });
  });

  it('shows a value of up to sixty characters in full', () => {
    const sixty = 'a'.repeat(60);
    expect(renderDescriptions(['Short value', sixty])).toEqual(['Short value', sixty]);
  });

  it('cuts a longer value to sixty characters and ends it with an ellipsis', () => {
    const value = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor';
    expect(renderDescriptions([value])).toEqual(['Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed…']);
  });

  it('collapses whitespace before measuring and drops a trailing space before the ellipsis', () => {
    const value = `  first line\n\nsecond   line ${'b'.repeat(36)} tail that does not fit`;
    expect(renderDescriptions([value])).toEqual([`first line second line ${'b'.repeat(36)}…`]);
  });
});
