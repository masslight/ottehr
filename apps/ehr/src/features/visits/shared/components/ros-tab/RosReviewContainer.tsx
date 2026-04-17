import { Box, Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { InPersonRosConfig } from 'utils';
import { useRosObservationsStore } from '../../stores/appointment/ros-observations.store';

export const RosReviewContainer: FC = () => {
  const state = useRosObservationsStore();
  const checkedObservations = Object.values(state).filter((obs) => obs.value === true);

  if (checkedObservations.length === 0) {
    return null;
  }

  // Group by system, separating denies and reports
  const systemGroups: Record<string, { label: string; denies: string[]; reports: string[] }> = {};

  for (const [systemKey, system] of Object.entries(InPersonRosConfig)) {
    const denies: string[] = [];
    const reports: string[] = [];

    for (const [fieldKey, item] of Object.entries(system.items)) {
      const deniesObs = state[`${fieldKey}-denies`];
      const reportsObs = state[`${fieldKey}-reports`];
      if (deniesObs?.value) denies.push(item.label);
      if (reportsObs?.value) reports.push(item.label);
    }

    if (denies.length > 0 || reports.length > 0) {
      systemGroups[systemKey] = { label: system.label, denies, reports };
    }
  }

  if (Object.keys(systemGroups).length === 0) return null;

  return (
    <Stack spacing={1.5}>
      <Typography variant="h5" color="primary.dark">
        Review of Systems
      </Typography>
      {Object.entries(systemGroups).map(([key, group]) => (
        <Box key={key}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
            {group.label}
          </Typography>
          {group.denies.length > 0 && (
            <Typography variant="body2" sx={{ color: 'success.main', fontSize: 13 }}>
              Denies: {group.denies.join(', ')}
            </Typography>
          )}
          {group.reports.length > 0 && (
            <Typography variant="body2" sx={{ color: 'error.main', fontSize: 13 }}>
              Reports: {group.reports.join(', ')}
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
};
