import { Box, Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { InPersonRosConfig } from 'utils';
import { useRosObservationsStore } from '../../stores/appointment/ros-observations.store';
import { ExamReviewGroup } from '../review-tab/components/ExamReviewGroup';

export const RosReviewContainer: FC = () => {
  const state = useRosObservationsStore();

  const sections: { key: string; label: string; items: { field: string; label: string; abnormal: boolean }[] }[] = [];

  for (const [systemKey, system] of Object.entries(InPersonRosConfig)) {
    const items: { field: string; label: string; abnormal: boolean }[] = [];

    for (const [fieldKey, item] of Object.entries(system.items)) {
      const deniesObs = state[`${fieldKey}-denies`];
      const reportsObs = state[`${fieldKey}-reports`];
      if (deniesObs?.value) {
        items.push({ field: `${fieldKey}-denies`, label: item.label, abnormal: false });
      }
      if (reportsObs?.value) {
        items.push({ field: `${fieldKey}-reports`, label: item.label, abnormal: true });
      }
    }

    if (items.length > 0) {
      sections.push({ key: systemKey, label: system.label, items });
    }
  }

  if (sections.length === 0) return null;

  return (
    <Stack spacing={1}>
      <Typography variant="h5" color="primary.dark">
        Review of Systems
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sections.map((section) => (
          <ExamReviewGroup key={section.key} label={section.label} items={section.items} />
        ))}
      </Box>
    </Stack>
  );
};
