import { Stack } from '@mui/material';
import { FC } from 'react';
import { KnownAllergiesPatientColumn } from '../../../shared/components/known-allergies/KnownAllergiesPatientColumn';
import { KnownAllergiesProviderColumn } from '../../../shared/components/known-allergies/KnownAllergiesProviderColumn';
import { MedicalHistoryDoubleCard } from '../../../shared/components/medical-history-tab/MedicalHistoryDoubleCard';
import { InfoAlert } from '../InfoAlert';
import { AllergiesNotes } from './AllergiesNotes';

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
