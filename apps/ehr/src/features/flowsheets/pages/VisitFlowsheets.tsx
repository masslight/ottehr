import { Stack, ToggleButtonGroup, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import React, { ReactElement, useState } from 'react';
import { ContainedPrimaryToggleButton } from 'src/components/ContainedPrimaryToggleButton';
import { Loader } from 'src/features/visits/shared/components/Loader';
import { PageTitle } from 'src/features/visits/shared/components/PageTitle';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { Flowsheets } from '../components/Flowsheets';

type VisitRange = 'up-to-visit' | 'all';

export const VisitFlowsheets = (): ReactElement => {
  const {
    resources: { appointment, patient },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();
  const [range, setRange] = useState<VisitRange>('up-to-visit');

  if (isAppointmentLoading) return <Loader />;
  if (appointmentError) return <Typography>Error: {appointmentError.message}</Typography>;
  if (!patient?.id) return <Typography>No data available</Typography>;

  // "Up to this visit" = visits dated on or before this visit's day, in the browser's zone.
  const asOf =
    range === 'up-to-visit' && appointment?.start
      ? DateTime.fromISO(appointment.start).endOf('day').toISO() ?? undefined
      : undefined;

  return (
    <Stack spacing={1}>
      <PageTitle
        label="Flowsheets"
        showIntakeNotesButton={false}
        actions={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={range}
            onChange={(_, value: VisitRange | null) => value && setRange(value)}
          >
            <ContainedPrimaryToggleButton value="up-to-visit">Up to this visit</ContainedPrimaryToggleButton>
            <ContainedPrimaryToggleButton value="all">All visits</ContainedPrimaryToggleButton>
          </ToggleButtonGroup>
        }
      />
      <Flowsheets patientId={patient.id} asOf={asOf} currentAppointmentId={appointment?.id} />
    </Stack>
  );
};
