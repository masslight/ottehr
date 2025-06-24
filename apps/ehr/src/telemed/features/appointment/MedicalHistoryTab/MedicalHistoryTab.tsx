import { Box } from '@mui/material';
import React, { FC } from 'react';
import { AdditionalQuestionsCard } from './AdditionalQuestions';
import { ChiefComplaintCard } from './ChiefComplaint';
import { CurrentMedicationsCard } from './CurrentMedications';
import { KnownAllergiesCard } from './KnownAllergies';
import { MedicalConditionsCard } from './MedicalConditions';
import { SurgicalHistoryCard } from './SurgicalHistory';

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
