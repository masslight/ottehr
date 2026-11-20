import { Box } from '@mui/material';
import { ReactElement } from 'react';
import { JOURNAL_COLORS } from '../helpers/journalHelpers';

export type DotColor = 'blue' | 'orange' | 'green' | 'purple' | 'none';

const DOT_COLORS: Record<DotColor, string> = {
  blue: JOURNAL_COLORS.blueDot,
  orange: JOURNAL_COLORS.orangeDot,
  green: JOURNAL_COLORS.greenDot,
  purple: JOURNAL_COLORS.purpleDot,
  none: 'transparent',
};

export const JournalDot = ({ color, size = 9 }: { color: DotColor; size?: number }): ReactElement => (
  <Box
    component="i"
    sx={{
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
      display: 'inline-block',
      bgcolor: DOT_COLORS[color],
    }}
  />
);
