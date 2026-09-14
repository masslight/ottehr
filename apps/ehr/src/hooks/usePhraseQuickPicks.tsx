import { otherColors } from '@ehrTheme/colors';
import { AddCircleOutline, DeleteOutlined as DeleteIcon, EditOutlined as EditIcon } from '@mui/icons-material';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useMemo } from 'react';
import { insertTextAtCaret } from '../helpers/insertTextAtCaret';
import { shortcutLabel } from '../helpers/keyboardShortcut';
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';
import { useCommandPaletteSource } from './useCommandPaletteSource';
import { usePhrases } from './usePhrases';

const DESCRIPTION_MAX_LENGTH = 60;
const PHRASES_CATEGORY = 'Phrases';
const PASTE_SHORTCUT = shortcutLabel('V');

/**
 * Registers the "Phrases" group: a "+" button on the group header plus one row per phrase.
 * Selecting a phrase inserts it when the palette was opened from a text field,
 * otherwise copies it to the clipboard; each phrase row also carries edit/delete actions.
 */
export function usePhraseQuickPicks(): void {
  const phrases = usePhrases();
  const insertTarget = useCommandPaletteStore((state) => state.insertTarget);
  const setPhraseDialog = useCommandPaletteStore((state) => state.setPhraseDialog);
  const registerGroupAction = useCommandPaletteStore((state) => state.registerGroupAction);
  const unregisterGroupAction = useCommandPaletteStore((state) => state.unregisterGroupAction);

  useEffect(() => {
    registerGroupAction(PHRASES_CATEGORY, {
      label: 'New phrase',
      icon: <AddCircleOutline fontSize="small" />,
      color: 'primary.main',
      onClick: () => setPhraseDialog({ mode: 'new' }),
    });

    return () => {
      unregisterGroupAction(PHRASES_CATEGORY);
    };
  }, [registerGroupAction, setPhraseDialog, unregisterGroupAction]);

  const items = useMemo<CommandPaletteItem[]>(() => {
    return phrases.map(
      (phrase, index): CommandPaletteItem => ({
        id: `phrase-${index}`,
        label: phrase.key,
        description: phrase.value.trim().replace(/\s+/g, ' ').slice(0, DESCRIPTION_MAX_LENGTH),
        inlineDescription: true,
        category: PHRASES_CATEGORY,
        keywords: [phrase.key, phrase.value],
        onSelect: () => {
          if (insertTarget) {
            insertTextAtCaret(insertTarget, phrase.value);
            return;
          }
          if (!navigator.clipboard?.writeText) {
            enqueueSnackbar('Could not copy to clipboard.', { variant: 'error' });
            return;
          }
          void navigator.clipboard.writeText(phrase.value).then(
            () => enqueueSnackbar(`Copied. Paste with ${PASTE_SHORTCUT}.`, { variant: 'success' }),
            () => enqueueSnackbar('Could not copy to clipboard.', { variant: 'error' })
          );
        },
        actions: [
          {
            id: 'edit',
            label: 'Edit phrase',
            icon: <EditIcon fontSize="small" />,
            color: 'primary.main',
            onClick: () => setPhraseDialog({ mode: 'edit', index }),
          },
          {
            id: 'delete',
            label: 'Delete phrase',
            icon: <DeleteIcon fontSize="small" />,
            color: otherColors.endCallButton,
            onClick: () => setPhraseDialog({ mode: 'delete', index }),
          },
        ],
      })
    );
  }, [insertTarget, phrases, setPhraseDialog]);

  useCommandPaletteSource('phrases', items);
}
