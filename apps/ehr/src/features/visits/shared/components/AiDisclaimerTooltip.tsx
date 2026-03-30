import { InfoOutlined } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import { FC } from 'react';

const AI_DISCLAIMER_TEXT =
  'AI generated outputs, recommendations, and suggestions are provided for informational purposes only and are not intended to replace professional medical judgment or clinical expertise. AI technology may produce inaccurate, incomplete, or misleading results, and you must independently verify, validate, and confirm all AI-generated information before making any clinical decisions or taking any actions based on these outputs.';

export const AiDisclaimerTooltip: FC = () => (
  <Tooltip title={AI_DISCLAIMER_TEXT}>
    <IconButton size="small" aria-label="AI disclaimer">
      <InfoOutlined sx={{ fontSize: '17px' }} />
    </IconButton>
  </Tooltip>
);
