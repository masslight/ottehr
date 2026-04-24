import SearchIcon from '@mui/icons-material/Search';
import { ButtonBase, InputBase, Typography } from '@mui/material';
import { FC } from 'react';
import { useCommandPaletteStore } from 'src/state/command-palette.store';

interface CommandPaletteSearchButtonProps {
  /** Optional min-width override — the in-person header has less room than the main nav. */
  minWidth?: number;
  /** Extra sx spacing (e.g. mr/ml) applied to the outer button. */
  sx?: object;
}

/**
 * Search-styled ButtonBase that opens the command palette on click. Embedded
 * InputBase is read-only and non-focusable so focus lands on the palette's
 * real search field once it opens. Reused by the main Navbar, the in-person
 * per-visit header, and the telemed appointment header so the shortcut
 * affordance is visible from every major screen.
 */
export const CommandPaletteSearchButton: FC<CommandPaletteSearchButtonProps> = ({ minWidth = 240, sx }) => {
  const openCommandPalette = useCommandPaletteStore((s) => s.open);
  const shortcutHint = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K';

  return (
    <ButtonBase
      onClick={() => openCommandPalette()}
      aria-label="Open command palette"
      sx={{
        display: { xs: 'none', sm: 'flex' },
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.75,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.secondary',
        minWidth,
        transition: 'background-color 120ms',
        '&:hover': { bgcolor: 'action.hover' },
        ...sx,
      }}
    >
      <SearchIcon fontSize="small" />
      <InputBase
        placeholder="Search…"
        readOnly
        // Swallow focus so the real search input in the palette takes it.
        inputProps={{ tabIndex: -1, 'aria-hidden': 'true' }}
        sx={{
          flexGrow: 1,
          pointerEvents: 'none',
          color: 'inherit',
          fontSize: '0.875rem',
        }}
      />
      <Typography variant="caption" sx={{ opacity: 0.7, fontFamily: 'monospace' }}>
        {shortcutHint}
      </Typography>
    </ButtonBase>
  );
};
