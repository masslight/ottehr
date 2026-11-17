import { Typography } from '@mui/material';
import React from 'react';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { PatientFormResponses } from '../../shared/components/patient-forms/PatientFormResponses';
import { useAppointmentData } from '../../shared/stores/appointment/appointment.store';

/** Every response to the practice's Questionnaires forms for this patient, across visits. */
export const Questionnaires: React.FC = () => {
  const { appointment, isAppointmentLoading } = useAppointmentData();

  if (isAppointmentLoading) return <Loader />;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <PatientFormResponses
      placement="questionnaires"
      scope="all-visits"
      pageTitle={<PageTitle label="Clinical Forms" showIntakeNotesButton={false} />}
    />
  );
};
