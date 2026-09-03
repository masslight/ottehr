import { Stack } from '@mui/material';
import { FC } from 'react';
import { MedicalHistoryDoubleCard } from '../../../shared/components/medical-history-tab/MedicalHistoryDoubleCard';
import { InfoAlert } from '../InfoAlert';
import { HospitalizationForm } from './HospitalizationForm';
import { HospitalizationNotes } from './HospitalizationNotes';
import { HospitalizationPatientComponent } from './HospitalizationPatientComponent';

export const HospitalizationBody: FC = () => (
  <Stack spacing={1}>
    <InfoAlert text="Ask: Has the patient had any prior overnight hospital stays or hospital admissions?" />
    <MedicalHistoryDoubleCard
      patientSide={<HospitalizationPatientComponent />}
      patientSideLabel="Patient provided"
      providerSide={<HospitalizationForm />}
      providerSideLabel="Healthcare staff input"
    />
    <HospitalizationNotes />
  </Stack>
);
