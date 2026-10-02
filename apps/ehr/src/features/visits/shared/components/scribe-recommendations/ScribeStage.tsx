import { aiIcon } from '@ehrTheme/icons';
import { Avatar, Box, Typography } from '@mui/material';
import { FC, ReactNode } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

interface ScribeStageProps {
  name: string;
  lead: string;
  children: ReactNode;
}

/** The tint shared by every Oystehr AI surface in the EHR. */
export const AI_SURFACE = '#E1F5FECC';

/** One step of the panel, introduced by an assistant message (avatar and speech bubble) above its content. */
export const ScribeStage: FC<ScribeStageProps> = ({ name, lead, children }) => (
  <Box
    component="section"
    aria-label={lead}
    data-testid={dataTestIds.scribeRecommendations.stage(name)}
    sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
  >
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Avatar
        sx={{
          flexShrink: 0,
          width: 28,
          height: 28,
          backgroundColor: '#FFFFFF',
          border: '1px solid',
          borderColor: '#B3E5FC',
        }}
      >
        <img src={aiIcon} alt="" aria-hidden style={{ width: 18 }} />
      </Avatar>
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
