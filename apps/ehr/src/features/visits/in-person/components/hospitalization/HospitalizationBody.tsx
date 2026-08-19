import { Stack } from '@mui/material';
import { FC } from 'react';
import { MedicalHistoryDoubleCard } from '../../../shared/components/medical-history-tab';
import { InfoAlert } from '../InfoAlert';
import { HospitalizationForm } from './HospitalizationForm';
import { HospitalizationNotes } from './HospitalizationNotes';
import { HospitalizationPatientComponent } from './HospitalizationPatientComponent';

// Everything on the Hospitalization intake screen below the page title. Rendered by
// the Hospitalization page and inline on the Review & Sign page (InlineEditSection).
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
