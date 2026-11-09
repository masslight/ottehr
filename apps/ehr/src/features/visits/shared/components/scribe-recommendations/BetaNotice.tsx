import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

export const AUTOCHART_BETA_NOTICE =
  'This is a Beta feature. The note is AI generated and may contain errors or omissions. Review and verify all ' +
  'content carefully against the patient encounter before signing.';

/** The Beta warning, styled like the ad hoc report builder's so AI-generated output reads the same everywhere. */
export const BetaNotice: FC = () => (
  <Box
    role="note"
    data-testid={dataTestIds.scribeRecommendations.betaNotice}
    sx={{
      p: 1.5,
      display: 'flex',
      alignItems: 'center',
      gap: 1.25,
      bgcolor: '#fde5e7',
      border: '1px solid #ff6c6c',
      borderRadius: 1,
    }}
  >
    <Box
      component="span"
      sx={{
        px: 0.75,
        py: 0.25,
        borderRadius: 0.75,
        bgcolor: '#ff6c6c',
        color: 'common.white',
        fontWeight: 900,
        fontSize: '0.9rem',
        letterSpacing: '0.05em',
        flexShrink: 0,
      }}
    >
      AI
    </Box>
    <Typography variant="body2" sx={{ color: 'common.black', fontSize: '0.9rem', fontWeight: 500 }}>
      {AUTOCHART_BETA_NOTICE}
    </Typography>
  </Box>
);
