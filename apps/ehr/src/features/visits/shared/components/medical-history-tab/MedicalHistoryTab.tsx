import { Box } from '@mui/material';
import { FC } from 'react';
import { AdditionalQuestionsCard } from '../additional-questions/AdditionalQuestionsCard';
import { KnownAllergiesCard } from '../known-allergies/KnownAllergiesCard';
import { ChiefComplaintCard } from './ChiefComplaint';
import { CurrentMedicationsCard } from './CurrentMedications/CurrentMedicationsCard';
import { MedicalConditionsCard } from './MedicalConditions/MedicalConditionsCard';
import { SurgicalHistoryCard } from './SurgicalHistory/SurgicalHistoryCard';

export const MedicalHistoryTab: FC = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <MedicalConditionsCard />
      <CurrentMedicationsCard />
      <KnownAllergiesCard />
      <SurgicalHistoryCard />
      <AdditionalQuestionsCard />
      <ChiefComplaintCard />
    </Box>
  );
};
