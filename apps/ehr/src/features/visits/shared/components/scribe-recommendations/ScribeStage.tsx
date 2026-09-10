import { Box, Typography, useTheme } from '@mui/material';
import { FC, ReactNode } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

interface ScribeStageProps {
  /** Position in the run of stages actually on screen, not a fixed identity. */
  number: number;
  name: string;
  lead: string;
  children: ReactNode;
}

/**
 * One step of the review. The panel reads as a short sequence — apply the template, then the
 * observations, then decide on orders — so each step introduces itself in plain language and
 * carries its own action rather than deferring to one button for the whole panel.
 */
export const ScribeStage: FC<ScribeStageProps> = ({ number, name, lead, children }) => {
  const theme = useTheme();

  return (
    <Box
      component="section"
      data-testid={dataTestIds.scribeRecommendations.stage(name)}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box
          aria-hidden
          sx={{
            flexShrink: 0,
            width: 20,
            height: 20,
            mt: '1px',
            borderRadius: '50%',
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {number}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {lead}
        </Typography>
      </Box>
      {children}
    </Box>
  );
};
