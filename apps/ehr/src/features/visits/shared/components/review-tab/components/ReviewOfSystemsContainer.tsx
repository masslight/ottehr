import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { SectionHeading } from 'src/features/visits/shared/components/NoteSectionHeading';
import { useChartFields } from '../../../hooks/useChartFields';

/**
 * Legacy container for charts with ros data saved via the free text field.
 */
export const ReviewOfSystemsContainer: FC = () => {
  const { data: chartFields } = useChartFields({ requestedFields: { ros: { _tag: 'ros' } } });
  const ros = chartFields?.ros?.text;

  if (!ros) return null;

  const formattedRos = ros.replace(/\\n/g, '\n');

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabRosContainer}
    >
      <SectionHeading>Review of systems</SectionHeading>
      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{formattedRos}</Typography>
    </Box>
  );
};
