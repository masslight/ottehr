import { Box, CircularProgress, Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { InPersonRosConfig } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useRosObservationsInitializationStore } from '../../stores/appointment/ros-observations.store';
import { ClearRosButton } from './ClearRosButton';
import { RosReviewContainer } from './RosReviewContainer';
import { RosTable } from './RosTable';

export const RosBody: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const hasInitialData = useRosObservationsInitializationStore((state) => state.hasInitialData);
  const isInlineFlow = useIsInlineFlow();

  if (!hasInitialData) {
    return (
      <Stack direction="row" justifyContent="center">
        <CircularProgress />
      </Stack>
    );
  }

  if (isReadOnly) {
    return (
      <AccordionCard>
        <Stack p={2}>
          <RosReviewContainer />
        </Stack>
      </AccordionCard>
    );
  }

  return (
    <Stack spacing={1}>
      {/* On its own screen this action sits in the page title, which the inline editor
          doesn't render — so inline it goes above the table instead. */}
      {isInlineFlow && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ClearRosButton />
        </Box>
      )}
      <RosTable config={InPersonRosConfig} />
    </Stack>
  );
};
