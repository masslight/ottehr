import { Stack } from '@mui/material';
import { FC } from 'react';
import { ChiefComplaintSection } from '../../../shared/components/ChiefComplaintSection';
import GeneralInfoCard from '../../../shared/components/patient-info/GeneralInfoCard';
import { VerifiedPatientInfo } from '../../../shared/components/patient-info/VerifiedPatientInfo';
import { PatientConditionPhotosCard } from '../../../shared/components/PatientConditionPhotosCard';

// Everything on the Chief Complaint intake screen below the page title. Rendered by the
// ChiefComplaintAndIntakeNotes page and inline on the Review & Sign page (InlineEditSection).
export const ChiefComplaintBody: FC = () => (
  <Stack spacing={1}>
    <GeneralInfoCard />
    <VerifiedPatientInfo />
    <ChiefComplaintSection />
    <PatientConditionPhotosCard />
  </Stack>
);
