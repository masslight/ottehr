import { useMemo } from 'react';
import { insertTextAtCaret } from '../helpers/insertTextAtCaret';
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';
import { useCommandPaletteSource } from './useCommandPaletteSource';
import { usePhrases } from './usePhrases';

const DESCRIPTION_MAX_LENGTH = 60;

/** Registers one "Phrases" item per phrase, only while the palette was opened from a text field. */
export function usePhraseQuickPicks(): void {
  const phrases = usePhrases();
  const insertTarget = useCommandPaletteStore((state) => state.insertTarget);

  const items = useMemo<CommandPaletteItem[]>(() => {
    if (!insertTarget) {
      return [];
    }

    return phrases.map((phrase, index) => ({
      id: `phrase-${index}`,
      label: phrase.key,
      description: phrase.value.replace(/\s+/g, ' ').slice(0, DESCRIPTION_MAX_LENGTH),
      category: 'Phrases',
      keywords: [phrase.key, phrase.value],
      onSelect: () => insertTextAtCaret(insertTarget, phrase.value),
    }));
  }, [insertTarget, phrases]);

  useCommandPaletteSource('phrases', items);
}
