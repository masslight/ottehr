import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from '../../../hooks/useChartFields';

export const HistoryOfPresentIllnessContainer: FC = () => {
  const { data: chartFields } = useChartFields({
    requestedFields: {
      chiefComplaint: {
        _tag: 'chief-complaint',
      },
    },
  });

  const historyOfPresentIllness = chartFields?.chiefComplaint?.text;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.progressNotePage.hpiContainer}
    >
      <Typography variant="h5" color="primary.dark">
        History of Present Illness
      </Typography>
      <Typography>{historyOfPresentIllness}</Typography>
    </Box>
  );
};
