import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import { Box, Chip, ListItemText, Menu, MenuItem } from '@mui/material';
import { FC, MouseEvent, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { scaled } from './scribeTheme';
import { NoteMode } from './types';

const testIds = dataTestIds.scribeRecommendations;

/**
 * Marks the menu's portal so the editor knows a click or a focus in it is still inside the row: the menu
 * is rendered under the body, where the click-away and blur guards would otherwise take it for a way out.
 */
export const NOTE_MODE_MENU_CLASS = 'scribe-note-mode-menu';

interface NoteModeChipProps {
  id: string;
  mode: NoteMode;
  /** How much the field already holds. Nothing means the choice is only add or skip. */
  existingWords?: number;
  disabled?: boolean;
}

interface NoteModeOption {
  mode: NoteMode;
  label: string;
  hint: string;
}

/** The choices for a field that already holds text, in the order they are offered. */
const optionsFor = (existingWords: number | undefined): NoteModeOption[] =>
  existingWords
    ? [
        { mode: 'append', label: 'Append', hint: `Adds after the ${existingWords} words already there` },
        { mode: 'replace', label: 'Replace', hint: 'Overwrites the current text' },
        { mode: 'skip', label: 'Skip', hint: 'Leaves the note as it is' },
      ]
    : [
        // An empty field has nothing to append to or replace: the text simply goes in, or it doesn't.
        { mode: 'append', label: 'Add', hint: 'Adds to the empty field' },
        { mode: 'skip', label: 'Skip', hint: 'Leaves the note as it is' },
      ];

/**
 * A note row's tick, as a chip: how its paragraph lands in a field that may already hold text. It stands
 * where "Already charted" would, reads as the mode word, and opens a menu of the modes on click. The click
 * is the chip's own — it must not open the row's editor, which any other click on the line does.
 */
export const NoteModeChip: FC<NoteModeChipProps> = ({ id, mode, existingWords, disabled }) => {
  const setNoteMode = useScribeRecommendationsStore((state) => state.setNoteMode);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const options = optionsFor(existingWords);
  const current = options.find((option) => option.mode === mode) ?? options[0];

  const open = (event: MouseEvent<HTMLElement>): void => {
    event.stopPropagation();
    setAnchor(event.currentTarget);
  };
  const choose = (next: NoteMode): void => {
    setNoteMode(id, next);
    setAnchor(null);
  };

  return (
    <>
      <Chip
        size="small"
        color="primary"
        variant="outlined"
        clickable
        disabled={disabled}
        onClick={open}
        label={
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
            {current.label}
            <ExpandMoreOutlinedIcon sx={{ fontSize: scaled(12) }} />
          </Box>
        }
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        data-testid={testIds.noteModeChip(id)}
        sx={{ height: scaled(20), fontSize: scaled(11) }}
      />
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        // A click in the menu — an item, or the backdrop closing it — bubbles through the portal to the row,
        // which would open the editor.
        onClick={(event) => event.stopPropagation()}
        className={NOTE_MODE_MENU_CLASS}
        data-testid={testIds.noteModeMenu(id)}
        MenuListProps={{ dense: true }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.mode}
            selected={option.mode === current.mode}
            onClick={() => choose(option.mode)}
            data-testid={testIds.noteModeOption(id, option.mode)}
          >
            <ListItemText
              primary={option.label}
              secondary={option.hint}
              primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
