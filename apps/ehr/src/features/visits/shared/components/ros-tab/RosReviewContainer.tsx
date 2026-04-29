import { Box, Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getRosFindingFieldKeys, InPersonRosConfig } from 'utils';
import { useRosObservationsStore } from '../../stores/appointment/ros-observations.store';
import { ExamReviewGroup } from '../review-tab/components/ExamReviewGroup';

export const RosReviewContainer: FC = () => {
  const state = useRosObservationsStore();

  const sections: { key: string; label: string; items: { field: string; label: string; abnormal: boolean }[] }[] = [];

  // gather up / organize the information for stored ros observations to be displayed in inline summaries
  for (const [systemKey, system] of Object.entries(InPersonRosConfig)) {
    const items: { field: string; label: string; abnormal: boolean }[] = [];

    for (const [baseKey, item] of Object.entries(system.items)) {
      const { deniesKey, reportsKey } = getRosFindingFieldKeys(baseKey);

      const denies = state[deniesKey];
      const reports = state[reportsKey];

      if (denies?.value) {
        items.push({
          field: deniesKey,
          label: item.label,
          abnormal: false,
        });
      }

      if (reports?.value) {
        items.push({
          field: reportsKey,
          label: item.label,
          abnormal: true,
        });
      }
    }

    if (items.length > 0) {
      sections.push({
        key: systemKey,
        label: system.label,
        items,
      });
    }
  }

  return (
    <Stack spacing={1} data-testid={dataTestIds.progressNotePage.rosReviewContainer}>
      <Typography variant="h5" color="primary.dark">
        Review of Systems
      </Typography>
      {sections.length ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sections.map((section) => (
            <ExamReviewGroup key={section.key} label={section.label} items={section.items} />
          ))}
        </Box>
      ) : (
        <Box>
          <Typography>No recorded review of systems</Typography>
        </Box>
      )}
    </Stack>
  );
};
