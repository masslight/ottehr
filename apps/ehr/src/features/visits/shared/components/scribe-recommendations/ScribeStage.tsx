import { aiIcon } from '@ehrTheme/icons';
import { Avatar, Badge, Box, Typography } from '@mui/material';
import { FC, ReactNode } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

interface ScribeStageProps {
  /** Position in the run of stages actually on screen, not a fixed identity. */
  number: number;
  name: string;
  lead: string;
  children: ReactNode;
}

/** The tint every Oystehr AI surface in the EHR uses, so the panel speaks in the same voice. */
const AI_SURFACE = '#E1F5FECC';

/**
 * One step of the review, introduced by the scribe itself. The lead is set as a message from the
 * assistant — avatar, numbered step, speech bubble — so the panel reads as advice being offered
 * in order rather than as three anonymous headings, and the work each step asks for sits
 * underneath it.
 */
export const ScribeStage: FC<ScribeStageProps> = ({ number, name, lead, children }) => (
  <Box
    component="section"
    aria-label={`Step ${number}: ${lead}`}
    data-testid={dataTestIds.scribeRecommendations.stage(name)}
    sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
  >
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        badgeContent={number}
        color="primary"
        sx={{
          flexShrink: 0,
          '& .MuiBadge-badge': { height: 15, minWidth: 15, fontSize: 9, fontWeight: 700, p: 0 },
        }}
      >
        <Avatar sx={{ width: 28, height: 28, backgroundColor: '#FFFFFF', border: '1px solid', borderColor: '#B3E5FC' }}>
          <img src={aiIcon} alt="" aria-hidden style={{ width: 18 }} />
        </Avatar>
      </Badge>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          backgroundColor: AI_SURFACE,
          // Square top-left corner points the bubble back at the avatar without a drawn tail.
          borderRadius: '2px 12px 12px 12px',
          px: 1.5,
          py: 1,
        }}
      >
        <Typography variant="body2">{lead}</Typography>
      </Box>
    </Box>
    {children}
  </Box>
);
