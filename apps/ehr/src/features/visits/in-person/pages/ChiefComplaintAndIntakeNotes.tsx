import { Stack } from '@mui/material';
import React from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { ChiefComplaintSection } from '../../shared/components/ChiefComplaintSection';
import { PageTitle } from '../../shared/components/PageTitle';
import GeneralInfoCard from '../../shared/components/patient-info/GeneralInfoCard';
import { VerifiedPatientInfo } from '../../shared/components/patient-info/VerifiedPatientInfo';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
import { IntakeNotes } from '../hooks/useIntakeNotes';

export const ChiefComplaintAndIntakeNotes: React.FC = () => {
  const { interactionMode } = useInPersonNavigationContext();

  return (
    <Stack spacing={1}>
      <PageTitle label="Chief Complaint & Intake Notes" showIntakeNotesButton={interactionMode === 'main'} />

      <GeneralInfoCard />

      <VerifiedPatientInfo />

      <ChiefComplaintSection />

      <AccordionCard label="Intake Notes">
        <IntakeNotes />
      </AccordionCard>
    </Stack>
  );
};
