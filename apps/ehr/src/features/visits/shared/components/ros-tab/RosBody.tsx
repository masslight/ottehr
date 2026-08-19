import { CircularProgress, Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { InPersonRosConfig } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useRosObservationsInitializationStore } from '../../stores/appointment/ros-observations.store';
import { RosReviewContainer } from './RosReviewContainer';
import { RosTable } from './RosTable';

// Everything on the Review of Systems screen below the page title. Rendered by the
// RosTab page and inline on the Review & Sign page (InlineEditSection).
export const RosBody: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const hasInitialData = useRosObservationsInitializationStore((state) => state.hasInitialData);

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

  return <RosTable config={InPersonRosConfig} />;
};
