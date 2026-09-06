import { Stack } from '@mui/material';
import { FC } from 'react';
import { MedicalConditionsPatientColumn } from '../../../shared/components/medical-history-tab/MedicalConditions/MedicalConditionsPatientColumn';
import { MedicalConditionsProviderColumn } from '../../../shared/components/medical-history-tab/MedicalConditions/MedicalConditionsProviderColumn';
import { MedicalHistoryDoubleCard } from '../../../shared/components/medical-history-tab/MedicalHistoryDoubleCard';
import { InfoAlert } from '../InfoAlert';
import { MedicalConditionsNotes } from './MedicalConditionsNotes';

export const MedicalConditionsBody: FC = () => (
  <Stack spacing={1}>
    <InfoAlert text="Ask: Does the patient have any significant past or ongoing medical issues?" />
    <MedicalHistoryDoubleCard
      label="Medical conditions"
      patientSide={<MedicalConditionsPatientColumn />}
      patientSideLabel="Patient provided"
      providerSide={<MedicalConditionsProviderColumn />}
      providerSideLabel="Healthcare staff input"
    />
    <MedicalConditionsNotes />
  </Stack>
);
