import { Stack } from '@mui/material';
import { FC } from 'react';
import { ChiefComplaintSection } from '../../../shared/components/ChiefComplaintSection';
import GeneralInfoCard from '../../../shared/components/patient-info/GeneralInfoCard';
import { VerifiedPatientInfo } from '../../../shared/components/patient-info/VerifiedPatientInfo';
import { PatientConditionPhotosCard } from '../../../shared/components/PatientConditionPhotosCard';

export const ChiefComplaintBody: FC = () => (
  <Stack spacing={1}>
    <GeneralInfoCard />
    <VerifiedPatientInfo />
    <ChiefComplaintSection />
    <PatientConditionPhotosCard />
  </Stack>
);
