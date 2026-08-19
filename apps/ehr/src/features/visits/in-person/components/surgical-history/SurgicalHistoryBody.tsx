import { Stack } from '@mui/material';
import { FC } from 'react';
import { MedicalHistoryDoubleCard } from '../../../shared/components/medical-history-tab/MedicalHistoryDoubleCard';
import { SurgicalHistoryPatientColumn } from '../../../shared/components/medical-history-tab/SurgicalHistory/SurgicalHistoryPatientColumn';
import { SurgicalHistoryProviderColumn } from '../../../shared/components/medical-history-tab/SurgicalHistory/SurgicalHistoryProviderColumn';
import { InfoAlert } from '../InfoAlert';
import { SurgicalHistoryNotes } from './SurgicalHistoryNotes';

// Everything on the Surgical History intake screen below the page title. Rendered by
// the SurgicalHistory page and inline on the Review & Sign page (InlineEditSection).
export const SurgicalHistoryBody: FC = () => (
  <Stack spacing={1}>
    <InfoAlert text="Ask: Has the patient ever had surgery? If yes, what was the surgery?" />
    <MedicalHistoryDoubleCard
      patientSide={<SurgicalHistoryPatientColumn />}
      patientSideLabel="Patient provided"
      providerSide={<SurgicalHistoryProviderColumn />}
      providerSideLabel="Healthcare staff input"
    />
    <SurgicalHistoryNotes />
  </Stack>
);
