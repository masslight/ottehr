import { Stack } from '@mui/material';
import { FC } from 'react';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useRosObservationsInitializationStore } from '../../stores/appointment/ros-observations.store';
import { PageTitle } from '../PageTitle';
import { ClearRosButton } from './ClearRosButton';
import { RosBody } from './RosBody';

export const RosTab: FC = () => {
  // Read only to gate the page-title action; the rest of the screen lives in RosBody.
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const hasInitialData = useRosObservationsInitializationStore((state) => state.hasInitialData);

  return (
    <Stack direction="column" gap={1}>
      <PageTitle
        label="Review of Systems"
        showIntakeNotesButton={false}
        actions={hasInitialData && !isReadOnly ? <ClearRosButton /> : undefined}
      />
      <RosBody />
    </Stack>
  );
};
