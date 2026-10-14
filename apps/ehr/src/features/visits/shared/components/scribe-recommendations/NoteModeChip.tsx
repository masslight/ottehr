import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import { Box, Chip, ListItemText, Menu, MenuItem } from '@mui/material';
import { FC, MouseEvent, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { scaled } from './scribeTheme';
import { NoteMode } from './types';

const testIds = dataTestIds.scribeRecommendations;

/** Marks the portalled menu so the editor's click-away and blur guards treat it as inside the row. */
export const NOTE_MODE_MENU_CLASS = 'scribe-note-mode-menu';

interface NoteModeChipProps {
  id: string;
  mode: NoteMode;
  /** Word count already in the field; without it the only choices are add or skip. */
  existingWords?: number;
  disabled?: boolean;
}

interface NoteModeOption {
  mode: NoteMode;
  label: string;
  hint: string;
}

const optionsFor = (existingWords: number | undefined): NoteModeOption[] =>
  existingWords
    ? [
        { mode: 'append', label: 'Append', hint: `Adds after the ${existingWords} words already there` },
        { mode: 'replace', label: 'Replace', hint: 'Overwrites the current text' },
        { mode: 'skip', label: 'Skip', hint: 'Leaves the note as it is' },
      ]
    : [
        // An empty field has nothing to append to or replace.
        { mode: 'append', label: 'Add', hint: 'Adds to the empty field' },
        { mode: 'skip', label: 'Skip', hint: 'Leaves the note as it is' },
      ];

/**
 * A note row's tick: a chip showing how its paragraph lands in the field, with a menu of modes. Its clicks
 * stop propagating so they don't open the row's editor.
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
        // Clicks in the menu (items or backdrop) bubble through the portal to the row and would open the editor.
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
