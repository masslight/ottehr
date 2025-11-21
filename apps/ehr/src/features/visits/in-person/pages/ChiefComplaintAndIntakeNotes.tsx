import { Stack } from '@mui/material';
import React from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { ChiefComplaintSection } from '../../shared/components/ChiefComplaintSection';
import { PageTitle } from '../../shared/components/PageTitle';
import GeneralInfoCard from '../../shared/components/patient-info/GeneralInfoCard';
import { VerifiedPatientInfo } from '../../shared/components/patient-info/VerifiedPatientInfo';
import { IntakeNotes } from '../hooks/useIntakeNotes';

export const ChiefComplaintAndIntakeNotes: React.FC = () => {
  return (
    <Stack spacing={1}>
      <PageTitle label="Chief Complaint & Intake Notes" showIntakeNotesButton={false} />

      <GeneralInfoCard />

      <VerifiedPatientInfo />

      <ChiefComplaintSection />

      <AccordionCard label="Intake Notes">
        <IntakeNotes />
      </AccordionCard>
    </Stack>
  );
};
