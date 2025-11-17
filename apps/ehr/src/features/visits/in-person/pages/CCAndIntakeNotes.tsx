import { Stack } from '@mui/material';
import React from 'react';
import { PageTitle } from '../../shared/components/PageTitle';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
import { PatientInfo } from './PatientInfo';

interface CCAndIntakeNotesProps {
  appointmentID?: string;
}

export const CCAndIntakeNotes: React.FC<CCAndIntakeNotesProps> = () => {
  const { interactionMode } = useInPersonNavigationContext();

  return (
    <Stack spacing={1}>
      <PageTitle label="CC & Intake Notes" showIntakeNotesButton={interactionMode === 'provider'} />
      <PatientInfo />
    </Stack>
  );
};
