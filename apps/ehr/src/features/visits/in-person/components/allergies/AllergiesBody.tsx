import { Stack } from '@mui/material';
import { FC } from 'react';
import { KnownAllergiesPatientColumn } from '../../../shared/components/known-allergies/KnownAllergiesPatientColumn';
import { KnownAllergiesProviderColumn } from '../../../shared/components/known-allergies/KnownAllergiesProviderColumn';
import { MedicalHistoryDoubleCard } from '../../../shared/components/medical-history-tab';
import { InfoAlert } from '../InfoAlert';
import { AllergiesNotes } from './AllergiesNotes';

// Everything on the Allergies intake screen below the page title. Rendered by the
// Allergies page and inline on the Review & Sign page (InlineEditSection).
export const AllergiesBody: FC = () => (
  <Stack spacing={1}>
    <InfoAlert text="Ask: Does the patient have any known allergies to medications, latex, or food?" />
    <MedicalHistoryDoubleCard
      patientSide={<KnownAllergiesPatientColumn />}
      patientSideLabel="Patient provided"
      providerSide={<KnownAllergiesProviderColumn />}
      providerSideLabel="Healthcare staff input"
    />
    <AllergiesNotes />
  </Stack>
);
