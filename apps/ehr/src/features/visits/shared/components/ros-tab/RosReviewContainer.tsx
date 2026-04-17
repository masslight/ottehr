import { Box, Chip, Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { ExamObservationDTO, InPersonRosConfig } from 'utils';
import { useRosObservationsStore } from '../../stores/appointment/ros-observations.store';

export const RosReviewContainer: FC = () => {
  const state = useRosObservationsStore();
  const checkedObservations = Object.values(state).filter((obs) => obs.value === true);

  if (checkedObservations.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No review of systems documented
      </Typography>
    );
  }

  // Group checked items by system
  const systemGroups: Record<string, { label: string; items: ExamObservationDTO[] }> = {};
  for (const [systemKey, system] of Object.entries(InPersonRosConfig)) {
    const systemItems = checkedObservations.filter((obs) => obs.field in system.items);
    if (systemItems.length > 0) {
      systemGroups[systemKey] = { label: system.label, items: systemItems };
    }
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        Review of Systems
      </Typography>
      {Object.entries(systemGroups).map(([key, group]) => (
        <Box key={key}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {group.label}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {group.items.map((obs) => {
              const itemConfig = InPersonRosConfig[key]?.items[obs.field];
              return (
                <Chip
                  key={obs.field}
                  label={itemConfig?.label || obs.label || obs.field}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 12 }}
                />
              );
            })}
          </Box>
        </Box>
      ))}
    </Stack>
  );
};
