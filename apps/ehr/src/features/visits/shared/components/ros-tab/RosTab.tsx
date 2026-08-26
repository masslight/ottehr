import { CircularProgress, Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { InPersonRosConfig } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useRosObservationsInitializationStore } from '../../stores/appointment/ros-observations.store';
import { PageTitle } from '../PageTitle';
import { ClearRosButton } from './ClearRosButton';
import { RosReviewContainer } from './RosReviewContainer';
import { RosTable } from './RosTable';

export const RosTab: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const hasInitialData = useRosObservationsInitializationStore((state) => state.hasInitialData);

  return (
    <Stack direction="column" gap={1}>
      <PageTitle
        label="Review of Systems"
        showIntakeNotesButton={false}
        actions={hasInitialData && !isReadOnly ? <ClearRosButton /> : undefined}
      />
      {!hasInitialData ? (
        <Stack direction="row" justifyContent="center">
          <CircularProgress />
        </Stack>
      ) : isReadOnly ? (
        <AccordionCard>
          <Stack p={2}>
            <RosReviewContainer />
          </Stack>
        </AccordionCard>
      ) : (
        <RosTable config={InPersonRosConfig} />
      )}
    </Stack>
  );
};
