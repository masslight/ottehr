import { alpha, Box, ButtonBase, CircularProgress, Typography } from '@mui/material';
import { Children, isValidElement, ReactElement, ReactNode } from 'react';

// Every tile is the same size whatever its label, so a group of them lines up.
const TILE_WIDTH = 96;
const TILE_HEIGHT = 72;
const TILE_GAP = 8;

interface ActionTileProps {
  label: string;
  icon: ReactElement;
  // Links (e.g. to another app) open in a new tab.
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  // Shows a spinner in place of the icon and disables the tile.
  loading?: boolean;
  // The page's main action, filled in the primary color.
  primary?: boolean;
}

// An icon over a short label, like the action tiles on the EHR's patient page.
export function ActionTile({ label, icon, href, onClick, disabled, loading, primary }: ActionTileProps): ReactElement {
  return (
    <ButtonBase
      focusRipple
      disabled={disabled || loading}
      onClick={onClick}
      {...(href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {})}
      sx={(theme) => ({
        width: TILE_WIDTH,
        height: TILE_HEIGHT,
        flexDirection: 'column',
        gap: 0.75,
        px: 0.75,
        borderRadius: 1,
        bgcolor: primary ? 'primary.main' : alpha(theme.palette.primary.main, 0.08),
        color: primary ? 'primary.contrastText' : 'text.secondary',
        transition: theme.transitions.create('background-color'),
        '&:hover': { bgcolor: primary ? 'primary.dark' : alpha(theme.palette.primary.main, 0.14) },
        '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
        '&.Mui-disabled': { opacity: 0.6 },
        '& .MuiSvgIcon-root': { fontSize: 20, color: primary ? 'inherit' : 'primary.main' },
      })}
    >
      {loading ? <CircularProgress size={20} color={primary ? 'inherit' : 'primary'} /> : icon}
      {/* Room for two lines, so the icons line up whether a label wraps or not */}
      <Typography
        component="span"
        sx={{
          minHeight: '2.4em',
          display: 'flex',
          alignItems: 'center',
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.2,
          textAlign: 'center',
        }}
      >
        {label}
      </Typography>
    </ButtonBase>
  );
}

// Up to four tiles share a row; more are split evenly over two rows. The rows are flush right, so the
// last tile, the page's main action, always ends the group.
export function ActionTileGroup({ children }: { children: ReactNode }): ReactElement {
  const count = Children.toArray(children).filter(isValidElement).length;
  const perRow = count <= 4 ? count : Math.ceil(count / 2);
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        alignContent: 'flex-start',
        gap: `${TILE_GAP}px`,
        width: perRow * TILE_WIDTH + (perRow - 1) * TILE_GAP,
        flexShrink: 0,
      }}
    >
      {children}
    </Box>
  );
}
