import SearchIcon from '@mui/icons-material/Search';
import { IconButton, Tooltip } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import { FC } from 'react';
import { useCommandPaletteStore } from 'src/state/command-palette.store';

interface CommandPaletteSearchButtonProps {
  /** Extra sx spacing (e.g. mr/ml) applied to the icon button. */
  sx?: SxProps<Theme>;
}

/**
 * Magnifying-glass icon button that opens the command palette. The palette has
 * its own search input, so this affordance doesn't need a text field of its own —
 * it just needs to be visibly present so users who don't know the ⌘K shortcut can
 * discover the feature. Reused by the main navbar and the in-person per-visit header.
 */
export const CommandPaletteSearchButton: FC<CommandPaletteSearchButtonProps> = ({ sx }) => {
  const openCommandPalette = useCommandPaletteStore((s) => s.open);
  const shortcutHint = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K';

  return (
    <Tooltip title={`Search (${shortcutHint})`}>
      <IconButton onClick={openCommandPalette} aria-label="Open search bar" sx={sx}>
        <SearchIcon />
      </IconButton>
    </Tooltip>
  );
};
