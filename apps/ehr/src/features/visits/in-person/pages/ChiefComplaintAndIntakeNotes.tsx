import { Stack } from '@mui/material';
import React from 'react';
import { ChiefComplaintSection } from '../../shared/components/ChiefComplaintSection';
import { PageTitle } from '../../shared/components/PageTitle';
import GeneralInfoCard from '../../shared/components/patient-info/GeneralInfoCard';
import { VerifiedPatientInfo } from '../../shared/components/patient-info/VerifiedPatientInfo';

export const ChiefComplaintAndIntakeNotes: React.FC = () => {
  return (
    <Stack spacing={1}>
      <PageTitle label="Chief Complaint" showIntakeNotesButton={false} />

      <GeneralInfoCard />

      <VerifiedPatientInfo />

      <ChiefComplaintSection />
    </Stack>
  );
};
