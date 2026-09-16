import { Stack } from '@mui/material';
import React from 'react';
import { PageTitle } from '../../shared/components/PageTitle';
import { ChiefComplaintBody } from '../components/chief-complaint/ChiefComplaintBody';

export const ChiefComplaintAndIntakeNotes: React.FC = () => {
  return (
    <Stack spacing={1}>
      <PageTitle label="Chief Complaint" showIntakeNotesButton={false} />
      <ChiefComplaintBody />
    </Stack>
  );
};
